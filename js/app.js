/**
 * WIAWIS Color Custom System
 * Version: 1.5.0
 * 
 * 구조:
 * - Step 1: 모델 선택
 * - Step 2: 패턴 선택
 * - Step 3: 색상 선택 (스타일 + 로고타입)
 * - Step 4: 최종 확인 + PDF 출력
 */

(function() {
  'use strict';

  // ============================================
  // 동적 스타일 삽입 (Phoenix 환경 대응)
  // ============================================
  const injectStyles = () => {
    if (document.getElementById('wiawis-dynamic-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'wiawis-dynamic-styles';
    styleEl.textContent = `
      @keyframes pearlPulse {
        0%, 100% { 
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px #ffd700, 0 0 12px rgba(255,215,0,0.6);
        }
        50% { 
          box-shadow: 0 0 0 2px #fff, 0 0 0 6px #ffd700, 0 0 20px rgba(255,215,0,0.9);
        }
      }
      
      @keyframes pearlShine {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      
      @keyframes shimmer {
        0% { background-position: -100% 0; }
        100% { background-position: 200% 0; }
      }

      /* 색상 이름 툴팁 (마우스오버 시 스와치 위에 레이어로 표시) */
      #wiawis-custom .color-item { overflow: visible; }
      #wiawis-custom .color-item .color-name {   /* #wiawis-custom * 초기화보다 우선하도록 id 포함 */
        position: absolute;
        bottom: 100%;
        top: auto;
        left: 50%;
        transform: translateX(-50%);
        margin: 0 0 8px 0;
        padding: 6px 11px;
        border-radius: 8px;
        background: #1d1d1f;
        color: #fff !important;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: -0.01em;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.28);
        pointer-events: none;
        z-index: 100;
        opacity: 0;
        transition: opacity .12s ease;
      }
      #wiawis-custom .color-item .color-name::after {
        content: '';
        position: absolute;
        top: 100%;
        left: calc(50% + var(--tip-arrow, 0px));
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #1d1d1f;
      }
      #wiawis-custom .color-item:hover .color-name,
      #wiawis-custom .color-item .color-name.sel { opacity: 1; }
    `;
    document.head.appendChild(styleEl);
  };
  
  // 스타일 즉시 삽입
  injectStyles();

  // ============================================
  // 설정
  // ============================================
  
  // 로컬 vs 프로덕션 자동 감지
  const isLocal = window.location.protocol === 'file:' || 
                  window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.port !== '';
  
  // GitHub Pages 감지
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  // BASE_URL 설정
  // - 로컬/GitHub Pages: 상대 경로 사용
  // - 외부 CDN 사용 시: CDN URL 입력
  const BASE_URL = (isLocal || isGitHubPages) 
    ? '.'  // 로컬 또는 GitHub Pages: 현재 폴더 기준
    : '.';  // 기본값도 상대 경로 (필요시 CDN URL로 변경 가능)
  
  console.log('Mode:', isLocal ? 'LOCAL' : (isGitHubPages ? 'GITHUB_PAGES' : 'PRODUCTION'), '| BASE_URL:', BASE_URL);
  
  // 10분 단위 캐시 키
  const getCacheKey = () => Math.floor(Date.now() / 600000);

  // ============================================
  // 상태 관리
  // ============================================
  const state = {
    currentStep: 0,
    config: null,
    
    // 선택된 값들
    selected: {
      model: null,      // { id, name, ... }
      pattern: null,    // { id, name, ... }
      frameFinish: 'matte',  // 메인/서브 컬러 통일 마감
      style: {
        main: { color: null, pearl: false },
        sub: { color: null, pearl: false },
        seatpost: { color: null, finish: 'matte', pearl: false },
        handlebar: { color: null, finish: 'matte', pearl: false }
      },
      logo: {
        type: null,     // { id, name }
        color: null,
        finish: 'matte'
      }
    },
    
    // UI 상태
    ui: {
      activePart: 'main',      // 현재 선택 중인 파트
      activeTab: 'style'       // 'style' | 'logo'
    },
    
    // 로드된 이미지들
    images: {}
  };

  // ============================================
  // 유틸리티
  // ============================================
  
  // config.json 로드 (GitHub Pages에서는 캐시 무효화)
  async function loadConfig() {
    const useCache = !isLocal && !isGitHubPages;
    const url = useCache
      ? `${BASE_URL}/config.json?t=${getCacheKey()}`  // CDN: 캐시 키 추가
      : `${BASE_URL}/config.json`;  // 로컬/GitHub Pages: 캐시 파라미터 없이
    const response = await fetch(url);
    if (!response.ok) throw new Error('Config load failed');
    return response.json();
  }

  // 이미지 URL 생성 (버전 기반 캐시)
  function getImageUrl(path) {
    if (isLocal || isGitHubPages) {
      return `${BASE_URL}/${path}`;  // 로컬/GitHub Pages: 캐시 파라미터 없이
    }
    const version = state.config?.version || '1.0.0';
    return `${BASE_URL}/${path}?v=${version}`;  // CDN: 버전 파라미터
  }

  // 이미지 로드
  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image load failed: ${path}`));
      img.src = getImageUrl(path);
    });
  }

  // HEX to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // config.json의 defaultStyle에서 기본값 가져오기
  function getDefaultStyle() {
    const defaults = state.config.defaultStyle || {};
    const frameColors = state.config.colors.frame;
    const logoColors = state.config.colors.logo;
    const logoTypes = state.config.logoTypes;
    
    // 기본 마감 (없으면 gloss)
    const defaultFinish = defaults.finish || 'gloss';
    
    // 기본 메인 컬러 (없으면 black)
    const mainColorId = defaults.mainColor || 'black';
    const mainColor = frameColors.find(c => c.id === mainColorId) || frameColors.find(c => c.id === 'black') || frameColors[0];
    
    // 기본 서브 컬러 (null이면 메인과 동일)
    const subColorId = defaults.subColor;
    const subColor = subColorId ? (frameColors.find(c => c.id === subColorId) || mainColor) : mainColor;
    
    // 기본 로고 타입 (없으면 basic)
    const logoTypeId = defaults.logoType || 'basic';
    const logoType = logoTypes.find(t => t.id === logoTypeId) || logoTypes[0];
    
    // 기본 로고 색상 (없으면 white)
    const logoColorId = defaults.logoColor || 'white';
    const logoColor = logoColors.find(c => c.id === logoColorId) || logoColors[0];
    
    // 기본 로고 마감 (없으면 기본 마감과 동일)
    const logoFinish = defaults.logoFinish || defaultFinish;
    
    return {
      finish: defaultFinish,
      mainColor,
      subColor,
      logoType,
      logoColor,
      logoFinish
    };
  }

  // 스타일 초기화 (Step 3 진입 또는 초기화 버튼)
  function resetToDefaultStyle() {
    const defaults = getDefaultStyle();
    
    state.selected.frameFinish = defaults.finish;
    state.selected.style = {
      main: { color: defaults.mainColor, pearl: false },
      sub: { color: defaults.subColor, pearl: false },
      seatpost: { color: null, finish: defaults.finish, pearl: false },
      handlebar: { color: null, finish: defaults.finish, pearl: false }
    };
    state.selected.logo = {
      type: defaults.logoType,
      color: defaults.logoColor,
      finish: defaults.logoFinish
    };
    state.ui.activePart = 'main';
  }

  // ============================================
  // 이미지 프리로딩
  // ============================================
  
  // 모든 이미지 미리 로드
  async function preloadModelImages(modelId) {
    const basePath = `assets/models/${modelId}`;
    const model = state.config.models.find(m => m.id === modelId);
    if (!model) return;
    
    const finishes = ['gloss', 'matte'];  // 유광/무광 둘 다
    
    const imagesToLoad = [
      `${basePath}/base.png`,
    ];
    
    // 싯포스트/핸들바 (패턴별, 유광/무광 각각)
    model.patterns.forEach(patternId => {
      finishes.forEach(finish => {
        imagesToLoad.push(`${basePath}/patterns/${patternId}/parts/${finish}/seatpost.png`);
        imagesToLoad.push(`${basePath}/patterns/${patternId}/parts/${finish}/handlebar.png`);
      });
    });
    
    // 패턴별 마스크 (통합 경로 + finish 경로 둘 다 프리로드, 없는 건 무시됨)
    model.patterns.forEach(patternId => {
      const pattern = state.config.patterns[patternId];
      pattern.layers.forEach(layer => {
        imagesToLoad.push(`${basePath}/patterns/${patternId}/${layer}.png`);        // 통합(신)
        finishes.forEach(finish => {
          imagesToLoad.push(`${basePath}/patterns/${patternId}/${finish}/${layer}.png`);  // finish(구)
        });
      });
    });
    
    // 로고
    state.config.logoTypes.forEach(lt => {
      imagesToLoad.push(`${basePath}/logos/matte/${lt.id}.png`);
      imagesToLoad.push(`${basePath}/logos/gloss/${lt.id}.png`);
    });

    // 하이라이트/그림자 오버레이 (무광/유광 × 그림자/하이라이트)
    const overlayCfg = state.config.overlays || {};
    Object.keys(overlayCfg).forEach(finishId => {
      const o = overlayCfg[finishId] || {};
      if (o.shadow) imagesToLoad.push(`${basePath}/${o.shadow}`);
      if (o.highlight) imagesToLoad.push(`${basePath}/${o.highlight}`);
    });

    // 텍스처 컬러 (UD 카본 등)
    (state.config.colors.frame || []).forEach(c => {
      if (c.type === 'texture' && c.texture) {
        imagesToLoad.push(`${basePath}/${c.texture}`);
      }
    });
    
    // 병렬 로드
    const loadPromises = imagesToLoad.map(path => {
      return loadImage(path).then(img => {
        state.images[path] = img;
      }).catch(() => {
        // 이미지 없으면 무시
      });
    });
    
    await Promise.all(loadPromises);
    console.log(`Preloaded ${Object.keys(state.images).length} images for ${modelId}`);
  }

  // 캐시된 이미지 가져오기
  function getCachedImage(path) {
    return state.images[path] || null;
  }

  // 패턴 마스크 로드: 통합 경로(신, patterns/{p}/{layer}.png) 우선 → 없으면 finish 경로(구, patterns/{p}/{finish}/{layer}.png) 폴백
  // 모델마다 구조가 섞여 있어도(예: radical=통합, waws=finish) 둘 다 정상 렌더되게 함
  async function loadPatternMask(basePath, patternId, layer, finish) {
    const unified = `${basePath}/patterns/${patternId}/${layer}.png`;
    const finishPath = `${basePath}/patterns/${patternId}/${finish}/${layer}.png`;
    const cached = getCachedImage(unified) || getCachedImage(finishPath);
    if (cached) return cached;
    try {
      const img = await loadImage(unified);        // 통합 먼저
      state.images[unified] = img;
      return img;
    } catch (e) { /* 통합 없음 → finish 폴백 */ }
    try {
      const img = await loadImage(finishPath);     // finish 폴백
      state.images[finishPath] = img;
      return img;
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // 렌더링 - 캔버스
  // ============================================
  
  // 음영 보존하면서 색상 적용
  function applyColorToMask(ctx, maskImage, colorHex, canvasWidth, canvasHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 마스크 그리기
    tempCtx.drawImage(maskImage, 0, 0, canvasWidth, canvasHeight);
    
    // 픽셀 데이터 가져오기
    const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const rgb = hexToRgb(colorHex);
    
    // 각 픽셀 처리 (음영 보존)
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      
      // 밝기 계산
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      
      // 색상 적용
      data[i] = Math.round(rgb.r * brightness);
      data[i + 1] = Math.round(rgb.g * brightness);
      data[i + 2] = Math.round(rgb.b * brightness);
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  }

  // ============================================
  // 특수효과 (v1.5.0)
  //   1) 카멜레온 (헥사 2색 보간)
  //   2) UD 카본 (텍스처 × brightness × 마스크 명암)
  //   3) 하이라이트/그림자 오버레이 (무광/유광 × 곱하기/스크린)
  // ============================================

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // 컬러 객체 → 스와치/도트용 CSS background 값
  function getColorCss(color) {
    if (!color) return 'transparent';
    if (color.swatch) return color.swatch;
    if (color.type === 'chameleon') {
      return `linear-gradient(135deg, ${color.color1} 0%, ${color.color2} 100%)`;
    }
    if (color.type === 'effect') {
      // 스와치도 stops 원본에서 직접 생성 (값 중복 방지)
      const stops = LOGO_EFFECT_STOPS[color.id];
      if (stops) {
        const parts = stops.map(s =>
          `rgb(${s[1][0]},${s[1][1]},${s[1][2]}) ${Math.round(s[0] * 100)}%`
        );
        // 캔버스 42°(우하향) → CSS 각도 132deg
        return `linear-gradient(${LOGO_GRADIENT_ANGLE + 90}deg, ${parts.join(', ')})`;
      }
    }
    return color.hex || '#cccccc';
  }

  // 컬러 객체 → 팬톤 표기 (특수 컬러는 '-')
  function getColorPantone(color) {
    return (color && color.pantone) ? color.pantone : '-';
  }

  // --------------------------------------------
  // 마스크 밝기 통계 (카멜레온용, 마스크당 1회 계산 후 캐시)
  //
  //  마스크 밝기가 좁은 구간(무광 waws는 lo~hi 폭이 48단계뿐)에 몰려 있고
  //  감마가 10을 넘어가므로, 정수 히스토그램으로 중앙값을 잡으면 반 단계
  //  오차가 감마를 타고 t 0.1 이상으로 증폭된다. 밝기 1단계를 16으로
  //  세분한 히스토그램을 써서 lo/hi/mid 를 소수로 산출한다.
  // --------------------------------------------
  const _maskLumStats = new WeakMap();
  const LUM_HIST_SCALE = 16;                        // 밝기 1단계 = 16 bin
  const LUM_HIST_N = 256 * LUM_HIST_SCALE;          // 4096

  function getMaskLumStats(maskImg, w, h) {
    let stats = _maskLumStats.get(maskImg);
    if (stats) return stats;

    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(maskImg, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;

    const hist = new Uint32Array(LUM_HIST_N);
    let total = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 10) continue;
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      let b = (lum * LUM_HIST_SCALE) | 0;
      if (b < 0) b = 0; else if (b >= LUM_HIST_N) b = LUM_HIST_N - 1;
      hist[b]++;
      total++;
    }

    // 반환값은 bin 인덱스가 아니라 소수 밝기값
    const percentile = (p) => {
      if (!total) return p < 0.5 ? 0 : 255;
      const target = total * p;
      let acc = 0;
      for (let b = 0; b < LUM_HIST_N; b++) {
        acc += hist[b];
        if (acc >= target) return b / LUM_HIST_SCALE;
      }
      return 255;
    };

    let min = 0, max = 255;
    for (let b = 0; b < LUM_HIST_N; b++) { if (hist[b]) { min = b / LUM_HIST_SCALE; break; } }
    for (let b = LUM_HIST_N - 1; b >= 0; b--) { if (hist[b]) { max = b / LUM_HIST_SCALE; break; } }

    stats = {
      min: min,
      max: max,
      lo: percentile(0.02),
      hi: percentile(0.98),
      mid: percentile(0.5),
      total: total
    };
    _maskLumStats.set(maskImg, stats);
    return stats;
  }

  // --------------------------------------------
  // 1) 카멜레온 — 밝기 정규화 후 2색 보간
  //    밝은 부분 = color1, 어두운 부분 = color2
  //
  //  [확정 방식] p2~p98 백분위 정규화 + 감마 자동보정
  //    마스크 밝기 분포가 밝은 쪽에 심하게 치우쳐 있어서(중앙값 0.84~0.96),
  //    0.5 중심으로 벌리는 contrast 만으로는 데이터가 통째로 1쪽으로 밀려
  //    clip 될 뿐이다. 먼저 감마로 중앙값을 0.5로 끌어온 뒤 contrast 를 건다.
  //
  //    감마는 하드코딩하지 않고 마스크마다 자동 산출된다.
  //      gamma = log(0.5) / log(midT),  midT = (중앙값 - lo) / (hi - lo)
  //    마감(무광/유광)·패턴별로 밝기 분포가 달라 값이 달라지는 것이 정상.
  //      예) waws 무광 γ≈10.7~18.0 / waws 유광 γ≈3.9~7.6
  //
  //    normalize    : 'percentile'(기본, p2~p98) | 'minmax'(원안 복원)
  //    autoMidpoint : 감마 보정 사용 여부.
  //                   기본값은 normalize 에 따라 결정 — percentile → true,
  //                   minmax → false (즉 normalize:'minmax' 한 줄로 원안 복원)
  //    contrast     : 감마 보정 후 적용하는 대비 확장. 기본 1.5
  // --------------------------------------------
  function applyChameleonToMask(ctx, maskImg, colorCfg, w, h) {
    const stats = getMaskLumStats(maskImg, w, h);
    const useMinMax = colorCfg.normalize === 'minmax';
    const lo = useMinMax ? stats.min : stats.lo;
    const hi = useMinMax ? stats.max : stats.hi;
    const span = (hi - lo) || 1;

    // 감마 보정 사용 여부: 미지정 시 percentile→true / minmax→false
    const useGamma = (typeof colorCfg.autoMidpoint === 'boolean')
      ? colorCfg.autoMidpoint
      : !useMinMax;

    // 중앙값이 0.5로 오도록 감마 자동 산출 (마스크별로 매번 다시 계산)
    let gamma = 1;
    let midT = (stats.mid - lo) / span;
    if (useGamma) {
      midT = Math.min(Math.max(midT, 0.02), 0.98);
      gamma = Math.log(0.5) / Math.log(midT);
      console.log(
        `[Chameleon] ${colorCfg.id} | lo=${lo.toFixed(2)} mid=${stats.mid.toFixed(2)} hi=${hi.toFixed(2)}` +
        ` | midT=${midT.toFixed(3)} → γ=${gamma.toFixed(2)}`
      );
    }

    const contrast = (typeof colorCfg.contrast === 'number') ? colorCfg.contrast : 1.5;
    const c1 = hexToRgb(colorCfg.color1) || { r: 255, g: 255, b: 255 };
    const c2 = hexToRgb(colorCfg.color2) || { r: 0, g: 0, b: 0 };

    // 정규화값(0~1) → 색상 LUT. 픽셀 루프에서 pow 를 돌리지 않기 위한 것.
    // 마스크가 완전 그레이스케일이 아니라(waws 기준 r==g==b 비율 4.2%)
    // 소수 밝기의 유효 단계가 정수 밝기의 약 2배(110 → 233)이므로,
    // 256이 아닌 2048단계 LUT를 정규화값으로 인덱싱해 계조를 살린다.
    const LUT_N = 2048;
    const lutR = new Uint8ClampedArray(LUT_N);
    const lutG = new Uint8ClampedArray(LUT_N);
    const lutB = new Uint8ClampedArray(LUT_N);
    for (let v = 0; v < LUT_N; v++) {
      let t = v / (LUT_N - 1);
      if (gamma !== 1) t = Math.pow(t, gamma);
      t = 0.5 + (t - 0.5) * contrast;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      lutR[v] = c2.r + (c1.r - c2.r) * t;
      lutG[v] = c2.g + (c1.g - c2.g) * t;
      lutB[v] = c2.b + (c1.b - c2.b) * t;
    }
    const lutScale = (LUT_N - 1) / span;

    const cv = makeCanvas(w, h);
    const cctx = cv.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(maskImg, 0, 0, w, h);
    const img = cctx.getImageData(0, 0, w, h);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      let k = ((lum - lo) * lutScale + 0.5) | 0;
      if (k < 0) k = 0; else if (k >= LUT_N) k = LUT_N - 1;
      d[i]     = lutR[k];
      d[i + 1] = lutG[k];
      d[i + 2] = lutB[k];
    }

    cctx.putImageData(img, 0, 0);
    ctx.drawImage(cv, 0, 0);
  }

  // --------------------------------------------
  // 2) UD 카본 — 텍스처 원본색 × brightness × 마스크 명암
  //    마스크 알파로 클리핑 (프레임 입체감 유지)
  // --------------------------------------------
  function applyUdCarbonToMask(ctx, maskImg, textureImg, colorCfg, w, h) {
    if (!textureImg) {
      // 텍스처 없으면 대체 단색으로 폴백
      applyColorToMask(ctx, maskImg, colorCfg.fallbackHex || '#2a2a2a', w, h);
      return;
    }
    const brightness = (typeof colorCfg.brightness === 'number') ? colorCfg.brightness : 1.6;

    const cv = makeCanvas(w, h);
    const cctx = cv.getContext('2d');

    // (1) 텍스처 + 밝기 보정
    cctx.filter = `brightness(${brightness})`;
    cctx.drawImage(textureImg, 0, 0, w, h);
    cctx.filter = 'none';

    // (2) 마스크 명암 곱하기 → 입체감 유지
    cctx.globalCompositeOperation = 'multiply';
    cctx.drawImage(maskImg, 0, 0, w, h);

    // (3) 마스크 알파로 클리핑
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(maskImg, 0, 0, w, h);

    cctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(cv, 0, 0);
  }

  // --------------------------------------------
  // 3) 하이라이트/그림자 오버레이
  //    PNG 알파에 강도가 내장되어 있으므로 기본 intensity = 1
  // --------------------------------------------
  const _overlayWarned = new Set();

  function drawFinishOverlays(ctx, basePath, finish) {
    const overlays = state.config.overlays;
    if (!overlays) return;
    const cfg = overlays[finish];
    if (!cfg) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const intensity = (typeof cfg.intensity === 'number') ? cfg.intensity : 1;

    const shadow = cfg.shadow ? getCachedImage(`${basePath}/${cfg.shadow}`) : null;
    const highlight = cfg.highlight ? getCachedImage(`${basePath}/${cfg.highlight}`) : null;

    if (!shadow && !highlight) {
      // 모델별로 오버레이를 순차 적용하는 동안 미제작 모델이 섞이므로
      // 매 렌더 경고하지 않고 조합당 1회만 알린다.
      const warnKey = `${basePath}|${finish}`;
      if (!_overlayWarned.has(warnKey)) {
        _overlayWarned.add(warnKey);
        console.info(`[Overlay] 오버레이 없음 — 건너뜀: ${basePath}/overlays/${finish}/`);
      }
      return;
    }

    if (shadow) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = intensity;
      ctx.drawImage(shadow, 0, 0, w, h);
    }
    if (highlight) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = intensity;
      ctx.drawImage(highlight, 0, 0, w, h);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------
  // 컬러 타입 디스패처 — 일반색 / 카멜레온 / 텍스처
  // --------------------------------------------
  function applyPaintToMask(ctx, maskImg, color, basePath, w, h) {
    if (!color) return;
    if (color.type === 'chameleon') {
      applyChameleonToMask(ctx, maskImg, color, w, h);
      return;
    }
    if (color.type === 'texture') {
      const tex = getCachedImage(`${basePath}/${color.texture}`);
      applyUdCarbonToMask(ctx, maskImg, tex, color, w, h);
      return;
    }
    applyColorToMask(ctx, maskImg, color.hex, w, h);
  }

  // --------------------------------------------
  // 4) 로고 특수효과 — 크롬 골드/실버, 홀로그램
  //    Python/PIL 실험 확정본 포팅. 각도·stops 수정 금지.
  //    · 그라데이션 각도 42°
  //    · 정규화 기준 = 실제 로고 픽셀 영역 (캔버스 전체 아님)
  //    · 구조: 어두움 → 하이라이트 → 최암부 → 밝아짐
  // --------------------------------------------
  const LOGO_GRADIENT_ANGLE = 42; // degrees (스와치 CSS 프리뷰용)
  const LOGO_HL_SHIFT = -0.18;     // 크롬 하이라이트를 로고 상단 쪽으로 이동


  const LOGO_EFFECT_STOPS = {
    'chrome-gold': [
      [0.00, [140, 110,  45]],
      [0.12, [180, 150,  70]],
      [0.18, [245, 235, 180]],
      [0.22, [255, 250, 220]],  // ★ 하이라이트
      [0.26, [245, 235, 180]],
      [0.32, [100,  75,  25]],  // ★ 최암부
      [0.42, [130, 100,  40]],
      [0.55, [180, 150,  65]],
      [0.70, [210, 180,  90]],
      [0.85, [230, 200, 110]],
      [1.00, [245, 215, 130]]
    ],

    'chrome-silver': [
      [0.00, [120, 125, 135]],
      [0.12, [160, 165, 175]],
      [0.18, [235, 240, 250]],
      [0.22, [255, 255, 255]],  // ★ 하이라이트
      [0.26, [235, 240, 250]],
      [0.32, [ 60,  65,  75]],  // ★ 최암부
      [0.42, [100, 105, 115]],
      [0.55, [150, 155, 165]],
      [0.70, [190, 195, 205]],
      [0.85, [215, 220, 230]],
      [1.00, [235, 240, 250]]
    ],

    // vivid 버전 확정
    'hologram': [
      [0.00, [120, 180, 220]],
      [0.12, [200, 130, 200]],
      [0.20, [140, 220, 200]],
      [0.28, [250, 240, 200]],
      [0.32, [255, 255, 255]],  // ★ 하이라이트
      [0.36, [255, 220, 240]],
      [0.44, [ 80,  60, 120]],  // ★ 최암부
      [0.52, [ 60, 100, 140]],
      [0.62, [220, 140, 180]],
      [0.72, [140, 200, 160]],
      [0.82, [200, 180, 220]],
      [1.00, [180, 210, 240]]
    ]
  };

  function sampleStops(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    const last = stops[stops.length - 1];
    if (t >= last[0]) return last[1];

    for (let i = 0; i < stops.length - 1; i++) {
      const [p1, c1] = stops[i];
      const [p2, c2] = stops[i + 1];
      if (t >= p1 && t < p2) {
        const k = (t - p1) / (p2 - p1 || 1);
        return [
          c1[0] + (c2[0] - c1[0]) * k,
          c1[1] + (c2[1] - c1[1]) * k,
          c1[2] + (c2[2] - c1[2]) * k
        ];
      }
    }
    return last[1];
  }

  // 마스크 → { '효과ID@WxH': canvas } 캐시 (픽셀 루프 재계산 방지)
  const _logoEffectCache = new WeakMap();

  function applyLogoEffect(maskImg, effectId, w, h) {
    const stops = LOGO_EFFECT_STOPS[effectId];
    if (!stops) {
      console.warn('[applyLogoEffect] 알 수 없는 효과:', effectId);
      return null;
    }

    let perMask = _logoEffectCache.get(maskImg);
    if (!perMask) {
      perMask = new Map();
      _logoEffectCache.set(maskImg, perMask);
    }
    const cacheKey = `${effectId}@${w}x${h}`;
    const cached = perMask.get(cacheKey);
    if (cached) return cached;

    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(maskImg, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // ============================================================
    // [v1.6.4] 메인 로고 자동 인식 + 각도 자동 + 하이라이트 위치
    //  - 로고 파일에 메인로고/제품명/헤드로고가 섞여 있어도
    //    "가장 큰 덩어리(연결요소) = 다운튜브 메인 로고"만 크롬 대상
    //  - 각도는 메인 로고 픽셀 분포(PCA)로 자동 (모델별 지정 불필요)
    //  - 작은 덩어리(제품명·헤드로고)는 효과 대표색으로 단색
    // ============================================================

    // --- (1) 다운스케일 격자에서 로고 존재 표시 (F=4 → x>>2) ---
    const F = 4;
    const gw = Math.ceil(w / F), gh = Math.ceil(h / F);
    const cell = new Uint8Array(gw * gh);
    for (let y = 0; y < h; y++) {
      const gyw = (y >> 2) * gw;
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) cell[gyw + (x >> 2)] = 1;
      }
    }
    // --- (2) 격자 팽창(반경1): 글자 사이 잇기, 멀리 떨어진 데칼은 분리 유지 ---
    const dil = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        if (!cell[gy * gw + gx]) continue;
        for (let ay = -1; ay <= 1; ay++) {
          const ny = gy + ay; if (ny < 0 || ny >= gh) continue;
          for (let ax = -1; ax <= 1; ax++) {
            const nx = gx + ax; if (nx < 0 || nx >= gw) continue;
            dil[ny * gw + nx] = 1;
          }
        }
      }
    }
    // --- (3) 연결요소 라벨링(BFS) → 최대 덩어리 = 메인 로고 ---
    const lab = new Int32Array(gw * gh);
    let curLabel = 0, best = 0, bestSize = 0;
    const stack = [];
    for (let s = 0; s < gw * gh; s++) {
      if (!dil[s] || lab[s]) continue;
      curLabel++; let size = 0; stack.length = 0; stack.push(s); lab[s] = curLabel;
      while (stack.length) {
        const c = stack.pop(); size++;
        const cx = c % gw, cy = (c / gw) | 0;
        for (let ay = -1; ay <= 1; ay++) {
          const ny = cy + ay; if (ny < 0 || ny >= gh) continue;
          for (let ax = -1; ax <= 1; ax++) {
            const nx = cx + ax; if (nx < 0 || nx >= gw) continue;
            const n = ny * gw + nx;
            if (dil[n] && !lab[n]) { lab[n] = curLabel; stack.push(n); }
          }
        }
      }
      if (size > bestSize) { bestSize = size; best = curLabel; }
    }
    const mainCell = new Uint8Array(gw * gh);
    for (let i = 0; i < mainCell.length; i++) mainCell[i] = (lab[i] === best) ? 1 : 0;
    const isMain = (x, y) => mainCell[(y >> 2) * gw + (x >> 2)] === 1;

    // --- (4) 메인 로고 픽셀로 PCA 각도 + 투영 min/max ---
    let sx = 0, sy = 0, cnt = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 40 && isMain(x, y)) { sx += x; sy += y; cnt++; }
    }
    if (cnt === 0) { ctx.putImageData(img, 0, 0); perMask.set(cacheKey, cv); return cv; }
    const cxm = sx / cnt, cym = sy / cnt;
    let sxx = 0, syy = 0, sxy = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 40 && isMain(x, y)) {
        const px = x - cxm, py = y - cym; sxx += px * px; syy += py * py; sxy += px * py;
      }
    }
    sxx /= cnt; syy /= cnt; sxy /= cnt;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    let vx, vy;
    if (Math.abs(sxy) > 1e-6) { vx = l1 - syy; vy = sxy; }
    else { vx = (sxx >= syy) ? 1 : 0; vy = (sxx >= syy) ? 0 : 1; }
    const axis = Math.atan2(vy, vx) + Math.PI / 2;   // 긴축(글자흐름)에 수직 = 크롬축
    const dx = Math.cos(axis), dy = Math.sin(axis);

    let gMin = Infinity, gMax = -Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 40 && isMain(x, y)) {
        const g = x * dx + y * dy; if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      }
    }
    const span = (gMax - gMin) || 1;

    // --- (5) 작은 덩어리(제품명·헤드로고)용 단색 = 효과 대표색 ---
    const solid = sampleStops(stops, 0.8);

    // --- (6) 채우기: 메인=크롬(하이라이트 LOGO_HL_SHIFT만큼 위로), 나머지=단색 ---
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] <= 10) { d[i + 3] = 0; continue; }
        if (isMain(x, y)) {
          let t = (x * dx + y * dy - gMin) / span + LOGO_HL_SHIFT;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          const c = sampleStops(stops, t);
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        } else {
          d[i] = solid[0]; d[i + 1] = solid[1]; d[i + 2] = solid[2];
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    perMask.set(cacheKey, cv);
    return cv;
  }

  // 로고 채색 디스패처 — 효과 컬러 / 기존 단색
  function applyLogoPaint(ctx, maskImg, color, w, h) {
    if (!color) return;
    if (color.type === 'effect' && LOGO_EFFECT_STOPS[color.id]) {
      const cv = applyLogoEffect(maskImg, color.id, w, h);
      if (cv) {
        ctx.drawImage(cv, 0, 0);
        return;
      }
    }
    applyColorToMask(ctx, maskImg, color.hex, w, h);
  }

  // ============================================
  // 펄 효과 시스템
  // ============================================
  
  // 펄 파티클 저장소
  let pearlParticles = [];
  let pearlAnimationId = null;
  let pearlBaseImage = null;
  let logoSheen = null;   // 로고 펄 광택 띠 정보 // 펄 효과 전 기본 이미지 저장
  
  // 마스크에서 유효한 픽셀 좌표 추출 (매우 촘촘하게 - 1픽셀 간격)
  function extractMaskPixels(maskImage, canvasWidth, canvasHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(maskImage, 0, 0, canvasWidth, canvasHeight);
    
    const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const pixels = [];
    
    // 매우 촘촘하게 샘플링 (1픽셀 간격)
    for (let y = 0; y < canvasHeight; y += 1) {
      for (let x = 0; x < canvasWidth; x += 1) {
        const i = (y * canvasWidth + x) * 4;
        if (data[i + 3] > 20) { // 알파값이 있는 픽셀만
          pixels.push({ x, y });
        }
      }
    }
    return pixels;
  }
  
  // 펄 스파클 생성 (색상과 어우러지도록 오파시티 조정)
  // 펄 굵기 프리셋 (1=약하게, 2=중간, 3=굵게). pearl:"gold2"의 끝 숫자로 지정, 없으면 2
  const PEARL_SIZE = {
    1: { base: 0.4, rand: 0.5 },  // 0.4~0.9px (약하게)
    2: { base: 0.7, rand: 0.8 },  // 0.7~1.5px (기본)
    3: { base: 1.3, rand: 1.3 }   // 1.3~2.6px (굵게)
  };

  // "gold2" → { name:'gold', size:2 }, "silver" → { name:'silver', size:2 }
  function parsePearl(pearl) {
    if (!pearl || typeof pearl !== 'string') return null;
    const mm = pearl.match(/^([a-zA-Z]+)([123])?$/);
    if (!mm) return null;
    return { name: mm[1], size: mm[2] ? parseInt(mm[2], 10) : 2 };
  }

  // 펄 색: config.pearlPresets[name].colors 배열 → 반투명 rgba 팔레트
  // (name 예: silver/gold/green/blue/chameleon). 없으면 null → 기본 흰 펄
  function pearlPalette(presetName) {
    const presets = state.config.pearlPresets || {};
    const p = presetName && presets[presetName];
    if (p && Array.isArray(p.colors) && p.colors.length) {
      const out = [];
      for (const hex of p.colors) {
        const c = hexToRgb(hex);
        if (c) out.push(`rgba(${c.r},${c.g},${c.b},0.7)`);
      }
      if (out.length) return out;
    }
    return null;
  }

  function generatePearlParticles(pixels, count = 5000, opts = {}) {
    const particles = [];
    if (pixels.length === 0) return particles;

    // 크기 프리셋
    // 크기: opts.size(1/2/3), 색: opts.name(프리셋 이름)
    const sz = PEARL_SIZE[opts.size] || PEARL_SIZE[2];
    // 색상: 프리셋 이름 있으면 그 팔레트, 없으면 기본 흰색 계열
    const colors = pearlPalette(opts.name) || [
      'rgba(255,255,255,0.7)',  // 반투명 순백
      'rgba(255,255,255,0.6)',  // 반투명 순백
      'rgba(255,254,248,0.65)', // 반투명 크림
      'rgba(248,252,255,0.6)',  // 반투명 블루틴트
      'rgba(255,248,248,0.6)',  // 반투명 핑크틴트
    ];
    
    for (let i = 0; i < count; i++) {
      const pixel = pixels[Math.floor(Math.random() * pixels.length)];
      particles.push({
        x: pixel.x + (Math.random() - 0.5) * 1,
        y: pixel.y + (Math.random() - 0.5) * 1,
        size: (Math.random() * sz.rand + sz.base) * (opts.sizeBoost || 1),   // pearlSize 프리셋
        blend: opts.blend || null,   // 'lighter' = 바탕보다 밝게 빛남(로고 펄)
        maxOpacity: (Math.random() * 0.3 + 0.4) * (opts.alpha || 1),  // 0.4 ~ 0.7 (× alpha 배율)
        baseOpacity: (Math.random() * 0.1 + 0.05) * (opts.alpha || 1),  // 0.05 ~ 0.15
        speed: Math.random() * 3 + 1.5,  // 반짝임 속도 (조금 느리게)
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: Math.random() > 0.97 ? 'cross' : 'dot'  // 3%만 십자가
      });
    }
    return particles;
  }
  
  // 십자가 스파클 그리기
  function drawCrossSparkle(ctx, x, y, size, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.3;  // 더 가늘게
    ctx.lineCap = 'round';
    
    // 십자가 (더 작게)
    const len = size * 1.2;
    ctx.beginPath();
    ctx.moveTo(x - len, y);
    ctx.lineTo(x + len, y);
    ctx.moveTo(x, y - len);
    ctx.lineTo(x, y + len);
    ctx.stroke();
    
    // 중앙 점 (더 작게)
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.min(alpha * 1.5, 1);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  // 펄 효과 렌더링 (애니메이션)
  function renderPearlEffect() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas || pearlParticles.length === 0 || !pearlBaseImage) {
      pearlAnimationId = null;
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const time = Date.now() * 0.001;
    
    // 기본 이미지 복원 (깜빡임 방지)
    ctx.drawImage(pearlBaseImage, 0, 0);
    
    // 로고 광택 띠 중심 (입자 번쩍임과 띠를 같은 위치로 맞춤)
    const sheenC = logoSheen ? (-0.25 + ((time * logoSheen.speed) % 1) * 1.5) : null;
    
    // 스파클 그리기 (빽빽하게)
    pearlParticles.forEach(p => {
      // 반짝임 계산 (부드러운 펄스 + 항상 약간 보임)
      const wave = Math.sin(time * p.speed + p.phase);
      const twinkle = Math.pow(Math.max(0, wave), 1.5);  // 1.5제곱 (부드럽게)
      let alpha = p.baseOpacity + (p.maxOpacity - p.baseOpacity) * twinkle;
      if (p.u !== undefined && sheenC !== null && logoSheen.flash) {
        const dd = (p.u - sheenC) / 0.1;
        alpha = Math.max(alpha, Math.exp(-dd * dd) * logoSheen.flash);   // 빛 띠 근처 입자 번쩍임
      }
      alpha = Math.min(1, alpha);
      ctx.globalCompositeOperation = p.blend || 'source-over';
      
      if (p.type === 'cross') {
        drawCrossSparkle(ctx, p.x, p.y, p.size, alpha, p.color);
      } else {
        // 작은 점
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    
    // 로고 펄 광택 띠: 로고 모양 안에서만 빛 띠가 대각선으로 천천히 지나감
    if (logoSheen) {
      const L = logoSheen, sc = L.canvas, sx = sc.getContext('2d');
      sx.globalCompositeOperation = 'source-over';
      sx.clearRect(0, 0, L.w, L.h);
      const c = sheenC;                                 // 띠 중심 (로고 밖→안→밖)
      const g = sx.createLinearGradient(0, L.h, L.w, 0);
      const w = 0.12;
      const clamp = v => Math.max(0, Math.min(1, v));
      g.addColorStop(clamp(c - w), 'rgba(255,255,255,0)');
      g.addColorStop(clamp(c), L.color);
      g.addColorStop(clamp(c + w), 'rgba(255,255,255,0)');
      sx.fillStyle = g; sx.fillRect(0, 0, L.w, L.h);
      sx.globalCompositeOperation = 'destination-in';  // 로고 모양으로 자르기
      sx.drawImage(L.mask, L.x, L.y, L.w, L.h, 0, 0, L.w, L.h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = L.strength;
      ctx.drawImage(sc, L.x, L.y);
      ctx.restore();
    }
    
    // 다음 프레임
    pearlAnimationId = requestAnimationFrame(renderPearlEffect);
  }
  
  // 펄 애니메이션 시작
  function startPearlAnimation() {
    if (pearlAnimationId) return; // 이미 실행 중
    renderPearlEffect();
  }
  
  // 펄 애니메이션 중지
  function stopPearlAnimation() {
    if (pearlAnimationId) {
      cancelAnimationFrame(pearlAnimationId);
      pearlAnimationId = null;
    }
    pearlParticles = [];
    pearlBaseImage = null;
    logoSheen = null;
  }

  // 프리뷰 렌더링 (부드러운 전환)
  async function renderPreview() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    const { model, pattern, style, logo } = state.selected;
    const frameFinish = state.selected.frameFinish || 'matte';
    
    if (!model || !pattern) return;
    
    // 펄 애니메이션 중지 (새로 그리기 전)
    stopPearlAnimation();
    
    const basePath = `assets/models/${model.id}`;
    
    try {
      // 캐시에서 이미지 가져오기 (없으면 로드)
      let baseImg = getCachedImage(`${basePath}/base.png`);
      if (!baseImg) {
        baseImg = await loadImage(`${basePath}/base.png`);
        state.images[`${basePath}/base.png`] = baseImg;
      }
      
      // 오프스크린 캔버스에서 렌더링 (번쩍임 방지)
      const offscreen = document.createElement('canvas');
      offscreen.width = baseImg.width;
      offscreen.height = baseImg.height;
      const offCtx = offscreen.getContext('2d');
      
      // 1. 배경
      offCtx.fillStyle = state.config.background || '#faf8f4';
      offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
      
      // 2. 베이스 이미지
      offCtx.drawImage(baseImg, 0, 0);
      
      // 3. 패턴별 레이어 (메인/서브는 frameFinish 사용)
      const patternConfig = state.config.patterns[pattern.id];
      const pearlMasks = [];      // 펄 적용된 마스크
      const nonPearlMasks = [];   // 펄 미적용 마스크 (차집합용)
      
      for (const layer of patternConfig.layers) {
        const partStyle = style[layer];
        if (partStyle?.color) {
          const finish = frameFinish;  // 메인/서브는 frameFinish 사용
          const maskImg = await loadPatternMask(basePath, pattern.id, layer, finish);
          if (!maskImg) continue;
          applyPaintToMask(offCtx, maskImg, partStyle.color, basePath, offscreen.width, offscreen.height);
          
          // 펄 적용 체크: 해당 파트에 pearl=true이고, pearlable 색상일 때만
          const hasPearl = partStyle.pearl === true;
          const isPearlable = !!partStyle.color.pearl;
          
          console.log(`[Pearl] ${layer}: pearl=${hasPearl}, preset=${partStyle.color.pearl || '-'}`);
          
          if (hasPearl && isPearlable) {
            pearlMasks.push({ img: maskImg, layer: layer });
            console.log(`[Pearl] Added to pearlMasks: ${layer}`);
          } else {
            // 펄이 없는 파트 마스크도 저장 (차집합 계산용)
            nonPearlMasks.push({ img: maskImg, layer: layer });
            console.log(`[Pearl] Added to nonPearlMasks: ${layer}`);
          }
        }
      }
      
      const partMaskImgs = {};   // 싯포스트·핸들바 마스크 (파츠 펄용)
      
      // 4. 싯포스트 (개별 finish 사용)
      if (style.seatpost?.color) {
        const finish = style.seatpost.finish || 'matte';
        const seatpostPath = `${basePath}/patterns/${pattern.id}/parts/${finish}/seatpost.png`;
        let seatpostImg = getCachedImage(seatpostPath);
        if (!seatpostImg) {
          try {
            seatpostImg = await loadImage(seatpostPath);
            state.images[seatpostPath] = seatpostImg;
          } catch (e) {}
        }
        if (seatpostImg) {
          applyPaintToMask(offCtx, seatpostImg, style.seatpost.color, basePath, offscreen.width, offscreen.height);
          partMaskImgs.seatpost = seatpostImg;   // 파츠 펄용
        }
      }
      
      // 5. 핸들바 (개별 finish 사용)
      if (style.handlebar?.color) {
        const finish = style.handlebar.finish || 'matte';
        const handlebarPath = `${basePath}/patterns/${pattern.id}/parts/${finish}/handlebar.png`;
        let handlebarImg = getCachedImage(handlebarPath);
        if (!handlebarImg) {
          try {
            handlebarImg = await loadImage(handlebarPath);
            state.images[handlebarPath] = handlebarImg;
          } catch (e) {}
        }
        if (handlebarImg) {
          applyPaintToMask(offCtx, handlebarImg, style.handlebar.color, basePath, offscreen.width, offscreen.height);
          partMaskImgs.handlebar = handlebarImg;   // 파츠 펄용
        }
      }
      
      // 6. 로고 (finish 폴더 구분)
      if (logo.type && logo.color) {
        const logoFinish = logo.finish || 'matte';
        const logoPath = `${basePath}/logos/${logoFinish}/${logo.type.id}.png`;
        let logoImg = getCachedImage(logoPath);
        if (!logoImg) {
          try {
            logoImg = await loadImage(logoPath);
            state.images[logoPath] = logoImg;
          } catch (e) {}
        }
        if (logoImg) {
          applyLogoPaint(offCtx, logoImg, logo.color, offscreen.width, offscreen.height);
        }
      }
      
      // 7. 하이라이트/그림자 오버레이 (프레임 마감 기준)
      drawFinishOverlays(offCtx, basePath, frameFinish);
      
      // 최종: 메인 캔버스에 한 번에 복사 (번쩍임 없음)
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(offscreen, 0, 0);
      
      // 프레임·파츠 펄: 파트별(메인/서브/싯포스트/핸들바)로 각자의 펄 색·굵기로 입자 생성
      const pearlOf = ps => (ps && ps.pearl && ps.color && ps.color.pearl) ? parsePearl(ps.color.pearl) : null;
      const layerImg = {};
      pearlMasks.concat(nonPearlMasks).forEach(m => { layerImg[m.layer] = m.img; });
      const groups = [];
      const mainP = pearlOf(style.main), subP = pearlOf(style.sub);
      if (mainP && layerImg.main) {
        let px = extractMaskPixels(layerImg.main, canvas.width, canvas.height);
        if (layerImg.sub) {   // main.png는 서브 영역을 포함 → 서브는 서브 설정으로 따로 처리
          const subSet = new Set(extractMaskPixels(layerImg.sub, canvas.width, canvas.height).map(p => `${p.x},${p.y}`));
          px = px.filter(p => !subSet.has(`${p.x},${p.y}`));
        }
        groups.push({ part: 'main', px, opts: mainP });
      }
      if (subP && layerImg.sub) groups.push({ part: 'sub', px: extractMaskPixels(layerImg.sub, canvas.width, canvas.height), opts: subP });
      for (const part of ['seatpost', 'handlebar']) {
        const pp = pearlOf(style[part]);
        if (pp && partMaskImgs[part]) groups.push({ part, px: extractMaskPixels(partMaskImgs[part], canvas.width, canvas.height), opts: pp });
      }
      if (groups.length > 0) {
        pearlBaseImage = document.createElement('canvas');
        pearlBaseImage.width = canvas.width;
        pearlBaseImage.height = canvas.height;
        pearlBaseImage.getContext('2d').drawImage(offscreen, 0, 0);
        // 로고 영역 제외 (프레임 펄이 로고 위에 뿌려지지 않도록)
        let logoSet = null;
        if (logo.type) {
          const logoFinishType = state.config.finishes.find(f => f.id === logo.finish)?.type || 'matte';
          const logoPath = `assets/models/${model.id}/logos/${logoFinishType}/${logo.type.id}.png`;
          let logoMaskImg = getCachedImage(logoPath);
          if (!logoMaskImg) { try { logoMaskImg = await loadImage(logoPath); state.images[logoPath] = logoMaskImg; } catch (e) {} }
          if (logoMaskImg) logoSet = new Set(extractMaskPixels(logoMaskImg, canvas.width, canvas.height).map(p => `${p.x},${p.y}`));
        }
        pearlParticles = [];
        for (const g of groups) {
          const px = logoSet ? g.px.filter(p => !logoSet.has(`${p.x},${p.y}`)) : g.px;
          if (!px.length) continue;
          const count = Math.min(Math.max(Math.round(px.length * 0.1), 300), 10000);
          pearlParticles = pearlParticles.concat(generatePearlParticles(px, count, { name: g.opts.name, size: g.opts.size }));
          console.log(`[Pearl] ${g.part} ${g.opts.name}${g.opts.size}: ${count} sparkles on ${px.length} px`);
        }
      }
      
      // 8. 로고(전사) 펄 — 전사 색에 pearl 속성이 있으면 로고 모양 위에만 펄 입자
      const logoPearl = (logo.type && logo.color && logo.color.pearl) ? parsePearl(logo.color.pearl) : null;
      if (logoPearl) {
        const lpPath = `${basePath}/logos/${logo.finish || 'matte'}/${logo.type.id}.png`;
        let lpImg = getCachedImage(lpPath);
        if (!lpImg) {
          try { lpImg = await loadImage(lpPath); state.images[lpPath] = lpImg; } catch (e) {}
        }
        if (lpImg) {
          // 로고 펄 조정값 (window.WIAWIS_LOGO_PEARL 로 덮어쓰기 가능)
          const LP = Object.assign({
            mode: 'static',   // static=실물처럼 고정 반짝이(조명 기반), flow=빛 띠가 흘러감
            levels: { 1: { density: 0.08, size: 0.6, alpha: 1 }, 2: { density: 0.38, size: 0.75, alpha: 0.55 }, 3: { density: 0.5, size: 0.7, alpha: 0.45 } },
            alpha: 1, inset: 2, blend: 'lighter', lightFloor: 0.3, lightGamma: 1.3,
            sheen: 0.3, sheenSpeed: 0.25, flash: 0.9
          }, state.config.logoPearl || {}, window.WIAWIS_LOGO_PEARL || {});
          const LV = (LP.levels && LP.levels[logoPearl.size]) || { density: 0.18, size: 1 };
          // 글자 윤곽이 뭉개지지 않도록 가장자리에서 inset px 안쪽 픽셀에만 입자 배치
          const lw = canvas.width, lh = canvas.height;
          const lc = document.createElement('canvas'); lc.width = lw; lc.height = lh;
          const lcx = lc.getContext('2d', { willReadFrequently: true });
          lcx.drawImage(lpImg, 0, 0, lw, lh);
          const la = lcx.getImageData(0, 0, lw, lh).data;
          const solid = (x, y) => x >= 0 && y >= 0 && x < lw && y < lh && la[(y * lw + x) * 4 + 3] > 200;
          const lpPixels = [];
          const k = LP.inset;
          for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
            if (!solid(x, y)) continue;
            if (k > 0 && !(solid(x - k, y) && solid(x + k, y) && solid(x, y - k) && solid(x, y + k))) continue;
            lpPixels.push({ x, y });
          }
          if (lpPixels.length > 0) {
            const lpCount = Math.min(Math.max(Math.round(lpPixels.length * LV.density), 150), 6000);
            const lpParticles = generatePearlParticles(lpPixels, lpCount, { name: logoPearl.name, size: 1, alpha: (LV.alpha != null ? LV.alpha : LP.alpha), blend: LP.blend, sizeBoost: LV.size });
            if (LP.mode === 'static') {
              // 실물 기준: 반짝이는 고정, 밝기는 이미지의 유광 하이라이트(반사광) 위치에 비례
              const oc = offscreen.getContext('2d', { willReadFrequently: true });
              const od = oc.getImageData(0, 0, lw, lh).data;
              const lumAt = (x, y) => {
                x = Math.max(0, Math.min(lw - 1, Math.round(x))); y = Math.max(0, Math.min(lh - 1, Math.round(y)));
                const i = (y * lw + x) * 4; return 0.299 * od[i] + 0.587 * od[i + 1] + 0.114 * od[i + 2];
              };
              const step = Math.max(1, Math.floor(lpPixels.length / 3000));
              const smp = []; for (let i = 0; i < lpPixels.length; i += step) smp.push(lumAt(lpPixels[i].x, lpPixels[i].y));
              smp.sort((a, b) => a - b);
              const lo = smp[Math.floor(smp.length * 0.1)], hi = smp[Math.floor(smp.length * 0.97)];
              const span = Math.max(8, hi - lo);
              oc.save();
              oc.globalCompositeOperation = LP.blend || 'lighter';
              for (const p of lpParticles) {
                let t = (lumAt(p.x, p.y) - lo) / span; t = t < 0 ? 0 : t > 1 ? 1 : t;
                const w = LP.lightFloor + (1 - LP.lightFloor) * Math.pow(t, LP.lightGamma);
                const big = p.type === 'cross';   // 일부 입자는 조금 더 크고 밝게 (실물의 굵은 반짝이)
                oc.globalAlpha = Math.min(1, p.maxOpacity * w * (big ? 1.3 : 1));
                oc.fillStyle = p.color;
                oc.beginPath(); oc.arc(p.x, p.y, big ? p.size * 1.6 : p.size, 0, Math.PI * 2); oc.fill();
              }
              oc.restore();
              canvas.getContext('2d').drawImage(offscreen, 0, 0);
              if (pearlBaseImage) pearlBaseImage.getContext('2d').drawImage(offscreen, 0, 0);   // 프레임 펄 애니메이션 배경에도 반영
              console.log(`[Pearl] Logo pearl(static) ${logo.color.pearl}: ${lpParticles.length} sparkles on ${lpPixels.length} px`);
            } else {
            // 광택 띠 준비 (로고 영역 bbox + 마스크)
            if (LP.sheen > 0) {
              let x0 = lw, y0 = lh, x1 = 0, y1 = 0;
              for (const q of lpPixels) { if (q.x < x0) x0 = q.x; if (q.y < y0) y0 = q.y; if (q.x > x1) x1 = q.x; if (q.y > y1) y1 = q.y; }
              const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
              const sheenCanvas = document.createElement('canvas'); sheenCanvas.width = bw; sheenCanvas.height = bh;
              const preset = (state.config.pearlPresets || {})[logoPearl.name];
              const tint = (preset && preset.colors && preset.colors[1]) || '#ffffff';
              const tr = hexToRgb(tint) || { r: 255, g: 255, b: 255 };
              logoSheen = { mask: lc, canvas: sheenCanvas, x: x0, y: y0, w: bw, h: bh,
                strength: LP.sheen, speed: LP.sheenSpeed,
                color: `rgba(${Math.round((tr.r + 255) / 2)},${Math.round((tr.g + 255) / 2)},${Math.round((tr.b + 255) / 2)},1)`,
                flash: LP.flash || 0 };
              const dd = bw * bw + bh * bh;
              for (const q of lpParticles) q.u = ((q.x - x0) * bw + (bh - (q.y - y0)) * bh) / dd;
            }
            if (!pearlBaseImage) {
              pearlBaseImage = document.createElement('canvas');
              pearlBaseImage.width = canvas.width;
              pearlBaseImage.height = canvas.height;
              pearlBaseImage.getContext('2d').drawImage(offscreen, 0, 0);
            }
            pearlParticles = pearlParticles.concat(lpParticles);
            console.log(`[Pearl] Logo pearl ${logo.color.pearl}: ${lpParticles.length} sparkles on ${lpPixels.length} px`);
            }
          }
        }
      }
      
      // 펄 입자가 하나라도 있으면 애니메이션 시작 (프레임 펄 + 로고 펄)
      if (pearlParticles.length > 0 && pearlBaseImage) {
        startPearlAnimation();
      }
      
    } catch (error) {
      console.error('Preview render error:', error);
    }
  }

  // ============================================
  // 렌더링 - UI
  // ============================================
  
  // Step 표시 바
  function renderStepBar() {
    return '';   // [v1.8.0] 단계 표시기(renderStepNav)로 통합
  }


  // ============================================================
  // 화면 문구: config.texts 로 덮어쓰기 가능 (비어 있거나 없는 항목은 아래 기본값 사용)
  // ============================================================
  const DEFAULT_TEXTS = {
    intro: {
      eyebrow: 'MAKE MY WIAWIS',
      title: '일상을 물들이는 나만의 특별한 위아위스',
      heroButton: '바로 시작하기',
      lead: '위아위스 커스텀 서비스로 나만의 자전거를 완성하세요',
      stepsTitle: '4단계로 완성하는 나만의 자전거',
      stepsSub: 'Design Your Dream Bikes in 4 Simple Steps',
      steps: [
        { title: '1. 모델 선택', desc: '마음에 드는 위아위스의 자전거 모델을 골라보세요. 최고의 기술력으로 설계된 모델이 준비되어 있습니다.' },
        { title: '2. 디자인 스타일 선택', desc: '디자인 스타일을 결정합니다. 위아위스 고유의 패턴은 물론 다양한 스타일의 디자인이 준비되어 있습니다.' },
        { title: '3. 컬러 커스터마이즈', desc: '자전거의 색상을 마음에 들게 꾸며보세요. 독특한 색상 조합과 패턴으로 나만의 자전거를 완성합니다.' },
        { title: '4. 디자인 상담하기', desc: '완성된 디자인을 확인합니다. 다양한 각도로 디자인을 확인하고 마음에 들지 않으면 다시 수정할 수 있습니다.' }
      ],
      guidebookButton: '커스텀 가이드북',
      startButton: '커스텀 시작하기',
      priceHeader: ['구분', '싱글|SINGLE', '더블/페이드|DOUBLE/FADE', '디자이너|DESIGNER'],
      priceRows: [
        { label: '신규제작', prices: ['60', '80', '130'] },
        { label: '컴포넌트', note: '신규 제작 - 컴포넌트 포함 (추가 비용) 핸들바 + 10만원, 싯포스트 +10만원' },
        { label: '재도장', prices: ['90', '110', '150'] }
      ],
      priceUnit: '만원',
      galleryTitle: '커스텀으로 제작된 디자인을 만나보세요.',
      galleryButton: '커스텀 갤러리 바로가기'
    },
    nav: { back: '‹ 커스텀 소개', steps: ['모델', '디자인', '컬러', '확인'] },
    headings: {
      '1': ['모델.', ' 어떤 자전거로 시작할까요?'],
      '2': ['디자인.', ' 패턴을 골라보세요.'],
      '3': ['컬러.', ' 나만의 조합을 골라보세요.'],
      '4': ['확인.', ' 완성된 디자인을 살펴보세요.']
    },
    pearlNotice: { suffix: ' - 펄 적용 컬러', desc: '이 색상은 펄이 기본 적용입니다. 화면의 효과는 참고용입니다.' }
  };
  // 'intro.title' 처럼 점으로 이어진 경로로 조회 (config.texts 우선)
  function T(path) {
    const get = (obj) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    const v = get(state.config && state.config.texts);
    return (v !== undefined && v !== null && v !== '') ? v : get(DEFAULT_TEXTS);
  }
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 단계 제목: "굵은 단어. 회색 문장" + 지금까지 고른 값
  function renderStepHeading(n) {
    const H = T('headings.' + n) || ['', ''];
    const { model, pattern } = state.selected;
    const vals = [n >= 2 && model ? model.name : null, n >= 3 && pattern ? pattern.name : null].filter(Boolean);
    return `<h2 class="step-title step-hl" data-step="${n}">${esc(H[0])}<span>${esc(H[1])}</span></h2>
          <p class="step-summary">${vals.map(esc).join(' · ') || '&nbsp;'}</p>`;
  }

  // 단계 표시기: 세그먼트 컨트롤 (현재 단계 = 흰 칸) + 왼쪽 '커스텀 소개'
  function renderStepNav() {
    const st = state.currentStep;
    const { model, pattern, style } = state.selected;
    const ready = { 1: true, 2: !!model, 3: !!(model && pattern && style?.main?.color), 4: !!(model && pattern && style?.main?.color) };
    const names = T('nav.steps') || [];
    const segs = [1, 2, 3, 4].map(n => {
      const label = esc(names[n - 1]);
      if (n === st) return `<span class="seg-item cur" aria-current="step">${label}</span>`;
      if (ready[n]) return `<button type="button" class="seg-item crumb-link" data-goto-step="${n}">${label}</button>`;
      return `<span class="seg-item off" aria-disabled="true">${label}</span>`;
    }).join('');
    return `
      <nav class="seg-nav" aria-label="커스텀 진행 단계">
        <button type="button" class="seg-back crumb-link" data-goto-step="0">${esc(T('nav.back'))}</button>
        <div class="seg">${segs}</div>
      </nav>
    `;
  }

  // Step 1: 모델 선택
  // ============================================================
  // Step 0: 커스텀 소개(인트로) — new.do 내용 재현, '시작하기'로 Step1 연결
  // ============================================================
  function renderStep0() {
    const IMG = 'assets/intro';
    const icons = [`${IMG}/step1.png`, `${IMG}/step2.png`, `${IMG}/step3.png`, `${IMG}/step4.png`];
    const steps = T('intro.steps') || [];
    // 갤러리: CMS가 window.WIAWIS_CUSTOM_GALLERY = [{img, caption, link}] 로 주입
    const gallery = (typeof window !== 'undefined' && Array.isArray(window.WIAWIS_CUSTOM_GALLERY)) ? window.WIAWIS_CUSTOM_GALLERY : [];
    const guidebookUrl = (typeof window !== 'undefined' && window.WIAWIS_GUIDEBOOK_URL) || `${IMG}/custom-guidebook.pdf`;
    const galleryUrl = (typeof window !== 'undefined' && window.WIAWIS_GALLERY_URL) || 'https://wiawis.com/bikes/kr/bikesCustom/gallery.do';
    // 가격표 (머리글 'A|B' = 위 A, 아래 작은 글씨 B)
    const head = (T('intro.priceHeader') || []).map((h, i) => {
      const [main, small] = String(h).split('|');
      return `<th scope="col"${i === 0 ? ' class="col-head"' : ''}>${esc(main)}${small ? `<small>${esc(small)}</small>` : ''}</th>`;
    }).join('');
    const unit = esc(T('intro.priceUnit'));
    const rows = (T('intro.priceRows') || []).map(r => r.note
      ? `<tr class="price-note"><th scope="row" class="col-head">${esc(r.label)}</th><td colspan="3">${esc(r.note)}</td></tr>`
      : `<tr><th scope="row" class="col-head">${esc(r.label)}</th>${(r.prices || []).map(p => `<td><b>${esc(p)}</b><span>${unit}</span></td>`).join('')}</tr>`
    ).join('');
    return `
      <div class="intro">
        <section class="intro-hero" style="background-image:url('${getImageUrl(IMG + '/custom_bg.jpg')}')">
          <div class="intro-hero-inner">
            <h2 class="intro-eyebrow">${esc(T('intro.eyebrow'))}</h2>
            <h3 class="intro-title">${esc(T('intro.title'))}</h3>
            <button class="btn-custom-start intro-cta light">${esc(T('intro.heroButton'))}</button>
          </div>
        </section>

        <p class="intro-lead">${esc(T('intro.lead'))}</p>

        <section class="intro-steps">
          <h3 class="intro-h2">${esc(T('intro.stepsTitle'))}</h3>
          <h4 class="intro-h2-sub">${esc(T('intro.stepsSub'))}</h4>
          <ol class="intro-step-grid">
            ${steps.slice(0, 4).map((st, i) => `
              <li class="intro-step">
                <div class="intro-step-icon"><img src="${getImageUrl(icons[i])}" alt="" width="80" height="80"></div>
                <h5>${esc(st.title)}</h5>
                <p>${esc(st.desc)}</p>
              </li>`).join('')}
          </ol>
          <div class="intro-actions">
            <a class="intro-cta ghost" href="${guidebookUrl}" target="_blank" rel="noopener">${esc(T('intro.guidebookButton'))}</a>
            <button class="btn-custom-start intro-cta">${esc(T('intro.startButton'))}</button>
          </div>
        </section>

        <section class="intro-price">
          <div class="intro-price-card">
            <table class="intro-price-table">
              <thead><tr>${head}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>

        <section class="intro-gallery">
          <h3 class="intro-h2">${esc(T('intro.galleryTitle'))}</h3>
          <div class="intro-gallery-grid" id="intro-gallery-grid">
            ${gallery.length ? gallery.map(g => `
              <figure class="intro-gallery-item">
                <a href="${g.link || g.img}" target="_blank" rel="noopener"><img src="${g.img}" alt="${esc(g.caption)}" loading="lazy"></a>
                <figcaption>${esc(g.caption)}</figcaption>
              </figure>`).join('') : '<p class="intro-gallery-empty">갤러리를 불러오는 중입니다…</p>'}
          </div>
          <a class="intro-cta ghost intro-gallery-link" href="${galleryUrl}">${esc(T('intro.galleryButton'))}</a>
        </section>
      </div>
    `;
  }

  function renderStep1() {
    const models = state.config.models;
    
    // 한글 모델명 매핑
    const modelNameKo = {
      'waws': '와스',
      'radical': '래디칼',
      'hexion': '헥시온'
    };
    
    return `
      <div class="step-container step-1">
        ${renderStepNav()}
        <div class="step-header">
          ${renderStepHeading(1)}
          ${renderStepBar()}
        </div>
        
        <div class="model-grid">
          ${models.map(model => `
            <div class="model-card ${state.selected.model?.id === model.id ? 'selected' : ''}" 
                 data-model-id="${model.id}">
              <h3 class="model-name">${model.name}</h3>
              <div class="model-image">
                <img src="${getImageUrl(`assets/models/${model.id}/thumb.png`)}" 
                     alt="${model.name}"
                     onerror="this.src='${getImageUrl(`assets/models/${model.id}/base.png`)}'">
              </div>
              <p class="model-desc">${model.description}</p>
              <p class="model-name-ko">${modelNameKo[model.id] || ''}(${model.name})</p>
              <button class="btn-select">선택하기</button>
            </div>
          `).join('')}
        </div>
        
        <div class="step-nav">
          <button class="btn-prev" data-step="0" style="padding:14px 35px;background:#f5f5f5;border:none;border-radius:30px;cursor:pointer;">
            <span style="color:#666;font-size:1rem;font-weight:500;">← 이전</span>
          </button>
        </div>
      </div>
    `;
  }

  // Step 2: 패턴 선택
  function renderStep2() {
    const model = state.selected.model;
    if (!model) return '';
    
    const patterns = model.patterns.map(pid => ({
      id: pid,
      ...state.config.patterns[pid]
    }));
    
    return `
      <div class="step-container step-2">
        ${renderStepNav()}
        <div class="step-header">
          ${renderStepHeading(2)}
          ${renderStepBar()}
        </div>
        
        <div class="pattern-grid">
          ${patterns.map(pattern => `
            <div class="pattern-card ${state.selected.pattern?.id === pattern.id ? 'selected' : ''}"
                 data-pattern-id="${pattern.id}">
              <div class="pattern-image">
                <img src="${getImageUrl(`assets/models/${model.id}/patterns/${pattern.id}/thumb.png`)}"
                     alt="${pattern.name}"
                     onerror="this.src='${getImageUrl(`assets/models/${model.id}/base.png`)}'">
              </div>
              <h3 class="pattern-name">${pattern.name}</h3>
              <p class="pattern-price">${pattern.price}</p>
              <p class="pattern-component-price">${pattern.componentPrice}</p>
              <p class="pattern-desc">${pattern.description}</p>
              <button class="btn-select-pattern">선택하기</button>
            </div>
          `).join('')}
        </div>
        
        <div class="step-nav">
          <button class="btn-prev" data-step="1" style="padding:14px 35px;background:#f5f5f5;border:none;border-radius:30px;cursor:pointer;">
            <span style="color:#666;font-size:1rem;font-weight:500;">← 이전</span>
          </button>
        </div>
      </div>
    `;
  }

  // Step 3: 색상 선택
  function renderStep3() {
    const { model, pattern, style, logo } = state.selected;
    const { activePart } = state.ui;
    
    if (!model || !pattern) return '';
    
    const allParts = state.config.parts;
    const finishes = state.config.finishes;
    const frameColors = state.config.colors.frame;
    const logoColors = state.config.colors.logo;
    const logoTypes = state.config.logoTypes;
    
    // 패턴에 따라 표시할 파트 필터링 (_로 시작하는 설명용 필드 제외)
    const patternLayers = pattern.layers;
    const visibleParts = Object.entries(allParts).filter(([partId, part]) => {
      // _로 시작하는 필드는 설명용이므로 제외
      if (partId.startsWith('_')) return false;
      
      if (partId === 'main' || partId === 'sub') {
        return patternLayers.includes(partId);
      }
      return true;
    });
    
    // activePart 유효성 검사
    const validActivePart = visibleParts.some(([id]) => id === activePart) 
      ? activePart 
      : visibleParts[0]?.[0] || 'main';
    
    if (validActivePart !== activePart) {
      state.ui.activePart = validActivePart;
    }
    
    // 파트에 따라 적용할 마감 결정
    const isFramePart = validActivePart === 'main' || validActivePart === 'sub';
    const currentFinish = isFramePart 
      ? (state.selected.frameFinish || 'matte')
      : (style[validActivePart]?.finish || 'matte');
    const isGloss = currentFinish === 'gloss';
    
    // 모바일 감지
    const isMobile = window.innerWidth <= 768;
    
    return `
      <div class="step-container step-3">
        ${renderStepNav()}
        <div class="step-header">
          ${renderStepHeading(3)}
          ${renderStepBar()}
        </div>
        
        <div class="step3-layout">
          <!-- 프리뷰 -->
          <div class="preview-section">
            <canvas id="preview-canvas"></canvas>
          </div>
          
          <!-- 컨트롤 -->
          <div class="control-section">
            <div class="control-toolbar"><button class="btn-reset-small" title="선택한 색상을 기본값으로 되돌립니다">↻ 선택 초기화</button></div>
            
            <!-- ========== 1. 스타일 섹션 ========== -->
            <div class="section-block" style="background:#fff;border-radius:8px;padding:20px;">
              <h3 class="section-title" style="font-size:1rem;font-weight:700;color:#222;margin:0 0 15px 0;">1. 스타일</h3>
              
              <!-- 파트 선택 -->
              <div class="part-cards part-cards-${visibleParts.length}" style="display:flex;justify-content:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid #f2f2f2;">
                ${visibleParts.map(([partId, part]) => {
                  const partStyle = style[partId];
                  const isActive = validActivePart === partId;
                  const hasColor = partStyle?.color;
                  // 메인/서브는 frameFinish, 싯포스트/핸들바는 개별 finish
                  const partIsFrame = partId === 'main' || partId === 'sub';
                  // 펄은 메인/서브에만 적용
                  const hasPearl = !!partStyle?.pearl;
                  const partFinish = partIsFrame ? (state.selected.frameFinish || 'matte') : (partStyle?.finish || 'matte');
                  const finishName = hasColor ? finishes.find(f => f.id === partFinish)?.name || '' : '';
                  const pearlText = hasPearl ? ' ✨' : '';
                  // 모든 파트 썸네일은 parts 폴더에서
                  const imgPath = `assets/models/${model.id}/patterns/${pattern.id}/parts/${partId}.png`;
                  const cardBorder = isActive ? '2px solid #1d1d1f' : '1px solid #e5e5ea';
                  const cardBg = '#fff';
                  return `
                    <div class="part-card ${isActive ? 'active' : ''} ${hasColor ? 'has-color' : ''}" data-part="${partId}"
                         style="border:${cardBorder};border-radius:12px;padding:8px;width:130px;text-align:center;cursor:pointer;background:${cardBg};">
                      <h6 style="font-size:0.75rem;font-weight:600;color:#333;margin:0 0 5px 0;">${part.name}${hasPearl ? '✨' : ''}</h6>
                      <div class="part-preview" style="width:110px;height:90px;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">
                        <img src="${getImageUrl(imgPath)}"
                             alt="${part.name}"
                             style="max-height:80px;max-width:100%;object-fit:contain;"
                             onerror="this.style.opacity='0.3'">
                      </div>
                      <div class="part-status" style="font-size:0.65rem;color:#666;min-height:28px;line-height:1.3;">
                        ${hasColor 
                          ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getColorCss(partStyle.color)};vertical-align:middle;margin-right:3px;${hasPearl ? 'box-shadow:0 0 0 1px rgba(0,0,0,.15);' : ''}"></span>
                             <span>${finishName}${pearlText}<br>${partStyle.color.name}</span>`
                          : '<span style="color:#999;">FINISH와 COLORS를<br>선택해주세요.</span>'}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              
              <!-- FINISH -->
              <div class="option-row" style="margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                  <span class="option-label" style="font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin:0;">FINISH</span>
                  ${isFramePart ? '<span style="font-size:0.65rem;color:#888;font-weight:400;">(메인/서브 통일)</span>' : ''}
                </div>
                <div class="option-buttons" style="display:flex;gap:10px;flex-wrap:wrap;">
                  ${(() => {
                    const isOptionalPart = validActivePart === 'seatpost' || validActivePart === 'handlebar';
                    const isNoneSelected = isOptionalPart && !style[validActivePart]?.color;
                    
                    return finishes.map(f => {
                      // currentFinish 기준으로 선택 상태 표시
                      const isSelected = !isNoneSelected && currentFinish === f.id;
                      const btnBg = isSelected ? '#222' : '#f0f0f0';
                      const btnBorder = isSelected ? '#222' : '#ccc';
                      const textColor = isSelected ? '#fff' : '#222';
                      const chipStyle = f.id === 'gloss'
                        ? 'display:inline-block;width:16px;height:16px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#fff 0%,#ddd 50%,#aaa 100%);border:1px solid #ccc;'
                        : 'display:inline-block;width:16px;height:16px;border-radius:50%;flex-shrink:0;background:#777;border:1px solid #666;';
                      return `
                      <button class="option-btn ${isSelected ? 'selected' : ''}"
                              data-finish="${f.id}"
                              style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:${btnBg};border:2px solid ${btnBorder};border-radius:18px;cursor:pointer;">
                        <span style="${chipStyle}"></span>
                        <span style="color:${textColor};font-size:0.85rem;font-weight:600;">${f.name}</span>
                      </button>
                    `}).join('');
                  })()}
                  ${(validActivePart === 'seatpost' || validActivePart === 'handlebar') ? (() => {
                    const isNoneSelected = !style[validActivePart]?.color;
                    const btnBg = isNoneSelected ? '#222' : '#f0f0f0';
                    const btnBorder = isNoneSelected ? '#222' : '#ccc';
                    const textColor = isNoneSelected ? '#fff' : '#222';
                    return `
                    <button class="option-btn ${isNoneSelected ? 'selected' : ''}"
                            data-finish-none
                            style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:${btnBg};border:2px solid ${btnBorder};border-radius:18px;cursor:pointer;">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:2px solid #c00;color:#c00;font-size:10px;background:#fff;">✕</span>
                      <span style="color:${textColor};font-size:0.85rem;font-weight:600;">선택안함</span>
                    </button>
                  `})() : ''}
                </div>
              </div>
              
              <!-- PEARL 안내 (pearlable 색상 선택 시) - 토글 없이 자동 적용 -->
              ${(() => {
                // 메인/서브가 아니면 숨김
                if (validActivePart !== 'main' && validActivePart !== 'sub') return '';
                
                const selectedColor = style[validActivePart]?.color;
                if (!selectedColor?.pearl) return '';
                
                return `
                <div class="option-row" style="margin-bottom:20px;">
                  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f5f5f7;border-radius:12px;border:0;">
                    <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#fff 0%,#ffd700 50%,#fff 100%);border:1px solid #d4af37;animation:pearlPulse 1.5s infinite;flex-shrink:0;"></span>
                    <div>
                      <span style="font-size:0.85rem;font-weight:700;color:#1d1d1f;">${esc(selectedColor.name)}${esc(T('pearlNotice.suffix'))}</span>
                      <p style="font-size:0.75rem;color:#6e6e73;margin:3px 0 0 0;">${esc(T('pearlNotice.desc'))}</p>
                    </div>
                  </div>
                </div>
                `;
              })()}
              
              <!-- COLORS -->
              <div class="option-row" style="margin-bottom:0;">
                <span class="option-label" style="display:block;font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">COLORS</span>
                <div class="color-grid ${isGloss ? 'gloss-mode' : ''}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:6px;max-height:284px;overflow-y:auto;padding:42px 4px 4px;">
                  ${frameColors.map(c => {
                    const isColorSelected = style[validActivePart]?.color?.id === c.id;
                    // 펄 효과는 메인/서브일 때만
                    const hasPearlEffect = isColorSelected && style[validActivePart]?.pearl;   // 파츠 포함
                    const swatchBorder = isColorSelected ? '2px solid #222' : '2px solid rgba(0,0,0,0.12)';
                    const swatchShadow = hasPearlEffect 
                      ? '0 0 0 2px #fff, 0 0 0 4px #ffd700, 0 0 12px rgba(255,215,0,0.6)' 
                      : (isColorSelected ? '0 0 0 2px #fff, 0 0 0 3px #222' : 'none');
                    // 펄 가능 표시도 메인/서브일 때만
                    const pearlIndicator = c.pearl ? '<span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:linear-gradient(135deg,#fff,#ffd700,#fff);border-radius:50%;border:1px solid #ccc;"></span>' : '';
                    return `
                    <div class="color-item" style="display:flex;flex-direction:column;align-items:center;position:relative;">
                      <button class="color-swatch ${isGloss ? 'gloss' : ''} ${isColorSelected ? 'selected' : ''}"
                              style="width:26px;height:26px;border-radius:50%;background:${getColorCss(c)};border:${swatchBorder};cursor:pointer;box-shadow:${swatchShadow};position:relative;${hasPearlEffect ? 'animation:pearlPulse 1.5s ease-in-out infinite;' : ''}"
                              data-color-id="${c.id}">
                        ${pearlIndicator}
                      </button>
                      <span class="color-name${isColorSelected ? ' sel' : ''}">${c.name}${hasPearlEffect ? ' ✨' : ''}</span>
                    </div>
                  `}).join('')}
                </div>
              </div>
            </div>
            
            <!-- ========== 2. 로고타입 섹션 ========== -->
            <div class="section-block" style="background:#fff;border-radius:8px;padding:20px;">
              <h3 class="section-title" style="font-size:1rem;font-weight:700;color:#222;margin:0 0 15px 0;">2. 로고타입</h3>
              
              <!-- 로고 타입 선택 -->
              <div class="logo-types" style="display:flex;justify-content:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid #f2f2f2;">
                ${logoTypes.map(lt => {
                  const isLogoActive = logo.type?.id === lt.id;
                  const logoBorder = isLogoActive ? '2px solid #1d1d1f' : '1px solid #e5e5ea';
                  return `
                  <div class="logo-type-card ${isLogoActive ? 'active' : ''}"
                       data-logo-type="${lt.id}"
                       style="border:${logoBorder};border-radius:12px;padding:8px;width:130px;text-align:center;cursor:pointer;background:#fff;">
                    <h6 style="font-size:0.75rem;font-weight:600;color:#333;margin:0 0 5px 0;">${lt.name}</h6>
                    <div class="logo-preview" style="width:110px;height:90px;display:flex;align-items:center;justify-content:center;margin:0 auto;">
                      <img src="${getImageUrl(`assets/models/${model.id}/logos/${lt.id}-thumb.png`)}"
                           style="max-height:80px;max-width:100%;object-fit:contain;"
                           onerror="this.style.opacity='0.3'">
                    </div>
                  </div>
                `}).join('')}
              </div>
              
              ${logo.type ? `
                <!-- 로고 FINISH -->
                <div class="option-row" style="margin-bottom:20px;">
                  <span class="option-label" style="display:block;font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">FINISH</span>
                  <div class="option-buttons" style="display:flex;gap:10px;flex-wrap:wrap;">
                    ${finishes.map(f => {
                      const isSelected = logo.finish === f.id;
                      const btnBg = isSelected ? '#222' : '#f0f0f0';
                      const btnBorder = isSelected ? '#222' : '#ccc';
                      const textColor = isSelected ? '#fff' : '#222';
                      const chipStyle = f.id === 'gloss'
                        ? 'display:inline-block;width:16px;height:16px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#fff 0%,#ddd 50%,#aaa 100%);border:1px solid #ccc;'
                        : 'display:inline-block;width:16px;height:16px;border-radius:50%;flex-shrink:0;background:#777;border:1px solid #666;';
                      return `
                      <button class="option-btn ${isSelected ? 'selected' : ''}"
                              data-logo-finish="${f.id}"
                              style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:${btnBg};border:2px solid ${btnBorder};border-radius:18px;cursor:pointer;">
                        <span style="${chipStyle}"></span>
                        <span style="color:${textColor};font-size:0.85rem;font-weight:600;">${f.name}</span>
                      </button>
                    `}).join('')}
                  </div>
                </div>
                
                <!-- 로고 COLORS -->
                <div class="option-row" style="margin-bottom:0;">
                  <span class="option-label" style="display:block;font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">COLORS</span>
                  <div class="color-grid ${logo.finish === 'gloss' ? 'gloss-mode' : ''}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:6px;max-height:284px;overflow-y:auto;padding:42px 4px 4px;">
                    ${logoColors.map(c => {
                      const isLogoColorSelected = logo.color?.id === c.id;
                      const swatchBorder = isLogoColorSelected ? '2px solid #222' : '2px solid rgba(0,0,0,0.12)';
                      const swatchShadow = isLogoColorSelected ? '0 0 0 2px #fff, 0 0 0 3px #222' : 'none';
                      return `
                      <div class="color-item" style="display:flex;flex-direction:column;align-items:center;position:relative;">
                        <button class="color-swatch ${logo.finish === 'gloss' ? 'gloss' : ''} ${isLogoColorSelected ? 'selected' : ''}"
                                style="width:26px;height:26px;border-radius:50%;background:${getColorCss(c)};border:${swatchBorder};cursor:pointer;box-shadow:${swatchShadow};position:relative;"
                                data-logo-color-id="${c.id}">
                          ${c.pearl ? '<span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:linear-gradient(135deg,#fff,#ffd700,#fff);border-radius:50%;border:1px solid #ccc;"></span>' : ''}
                        </button>
                        <span class="color-name${isLogoColorSelected ? ' sel' : ''}">${c.name}${c.pearl ? ' ✨' : ''}</span>
                      </div>
                    `}).join('')}
                  </div>
                </div>
              ` : '<p class="hint-text" style="color:#999;font-size:0.9rem;text-align:center;padding:20px;">로고 타입을 먼저 선택해주세요.</p>'}
            </div>
            
            <!-- 완성된 디자인 확인하기 버튼 -->
            <button class="btn-confirm" data-step="4" style="display:block;width:100%;padding:14px 20px;margin-top:20px;background:#222;border:none;border-radius:22px;cursor:pointer;">
              <span style="color:#fff;font-size:0.95rem;font-weight:600;">완성된 디자인 확인하기</span>
            </button>
          </div>
        </div>
        
        <div class="step-nav" style="margin-top:25px;">
          <button class="btn-prev" data-step="2" style="padding:10px 25px;background:#f5f5f5;border:none;border-radius:20px;cursor:pointer;">
            <span style="color:#666;font-size:0.9rem;font-weight:500;">← 이전</span>
          </button>
        </div>
      </div>
    `;
  }

  // Step 4: 최종 확인
  function renderStep4() {
    const { model, pattern, style, logo } = state.selected;
    const parts = state.config.parts;
    const finishes = state.config.finishes;
    const frameFinish = state.selected.frameFinish || 'gloss';
    
    if (!model || !pattern) return '';
    
    const getFinishName = (id) => finishes.find(f => f.id === id)?.name || '';
    
    // 선택된 스타일만 필터링 (_로 시작하는 필드 제외)
    const selectedStyles = Object.entries(parts)
      .filter(([partId]) => !partId.startsWith('_') && style[partId]?.color)
      .map(([partId, part]) => {
        const partStyle = style[partId];
        // 메인/서브는 frameFinish 사용
        const isFramePart = partId === 'main' || partId === 'sub';
        const finishId = isFramePart ? frameFinish : partStyle.finish;
        return {
          partId,
          name: part.name,
          color: partStyle.color,
          finish: finishId,
          pearl: !!(partStyle.pearl && partStyle.color && partStyle.color.pearl)  // 파츠 포함
        };
      });
    
    return `
      <div class="step-container step-4">
        ${renderStepNav()}
        <div class="step-header">
          ${renderStepHeading(4)}
          ${renderStepBar()}
        </div>
        
        <div class="step4-layout">
          <!-- 좌측: 프리뷰 -->
          <div class="preview-section final">
            <canvas id="preview-canvas"></canvas>
          </div>
          
          <!-- 우측: 요약 -->
          <div class="summary-section">
            <div class="summary-header">
              <h3>${model.name} > ${pattern.name}</h3>
            </div>
            
            <!-- 스타일 -->
            <div class="summary-group">
              <h4>● 스타일</h4>
              <div class="summary-card">
                ${selectedStyles.map(s => `
                  <div class="summary-row">
                    <span class="row-label">${s.name}</span>
                    <div class="row-value">
                      <span class="color-dot" style="background:${getColorCss(s.color)}"></span>
                      <span class="finish-text">${getFinishName(s.finish)}</span>
                      <span class="color-name">${s.color.name}${s.pearl ? ' <span class="pearl-badge">✨ 펄</span>' : ''}</span>
                      <span class="pantone-code">(${getColorPantone(s.color)})</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <!-- 로고타입 -->
            ${logo.type ? `
              <div class="summary-group">
                <h4>● 로고타입</h4>
                <div class="summary-card">
                  <div class="summary-row">
                    <span class="row-label">${logo.type.name}</span>
                    <div class="row-value">
                      ${logo.color ? `
                        <span class="color-dot" style="background:${getColorCss(logo.color)}"></span>
                        <span class="finish-text">${getFinishName(logo.finish)}</span>
                        <span class="color-name">${logo.color.name}</span>
                        <span class="pantone-code">(${getColorPantone(logo.color)})</span>
                      ` : '<span class="color-name">-</span>'}
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
            
            <div class="action-buttons">
              <button class="btn-edit" data-step="3">
                <span>디자인 수정하기</span>
              </button>
              <button class="btn-pdf">
                <span>디자인 사양서 다운로드</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 메인 렌더
  // 커스텀 영역 맨 위로 스크롤 (사이트 고정 헤더 고려해 80px 여유)
  function scrollToCustomTop() {
    const el = document.getElementById('wiawis-custom');
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // 색 이름표가 색상 영역 좌우 밖으로 나가지 않게 보정 (화살표는 스와치를 계속 가리킴)
  function fitColorTip(el) {
    if (!el) return;
    const grid = el.closest('.color-grid');
    if (!grid) return;
    el.style.transform = 'translateX(-50%)';
    el.style.setProperty('--tip-arrow', '0px');
    const r = el.getBoundingClientRect(), g = grid.getBoundingClientRect();
    let dx = 0;
    if (r.left < g.left + 4) dx = g.left + 4 - r.left;
    else if (r.right > g.right - 4) dx = g.right - 4 - r.right;
    if (dx) {
      el.style.transform = `translateX(calc(-50% + ${Math.round(dx)}px))`;
      el.style.setProperty('--tip-arrow', `${Math.round(-dx)}px`);
    }
  }

  let _lastRenderedStep = null;   // 단계 전환 감지용

  function render() {
    const container = document.getElementById('wiawis-custom');
    if (!container) return;
    const _stepChanged = _lastRenderedStep !== null && _lastRenderedStep !== state.currentStep;
    _lastRenderedStep = state.currentStep;
    
    // [v1.6.4] 색상 그리드 스크롤 위치 보존 (색 선택 시 초기화 방지)
    const _gridScroll = [...container.querySelectorAll('.color-grid')].map(el => el.scrollTop);
    
    let html = '';
    
    switch (state.currentStep) {
      case 0: html = renderStep0(); break;
      case 1: html = renderStep1(); break;
      case 2: html = renderStep2(); break;
      case 3: html = renderStep3(); break;
      case 4: html = renderStep4(); break;
    }
    
    container.innerHTML = html;
    
    // 스크롤 위치 복원
    container.querySelectorAll('.color-grid').forEach((el, i) => {
      if (_gridScroll[i] != null) el.scrollTop = _gridScroll[i];
    });
    
    // 프리뷰 렌더링 (Step 3, 4)
    if (state.currentStep >= 3) {
      setTimeout(renderPreview, 100);
    }
    
    // 이벤트 바인딩
    bindEvents();
    
    // 색 이름표 위치 보정 (선택된 이름표 + 마우스 올린 이름표)
    container.querySelectorAll('.color-item').forEach(it => it.addEventListener('mouseenter', () => fitColorTip(it.querySelector('.color-name'))));
    requestAnimationFrame(() => container.querySelectorAll('.color-name.sel').forEach(fitColorTip));
    
    // 단계가 바뀌면 커스텀 영역 맨 위로 (이전 단계의 스크롤 위치가 남아 제목이 가려지는 문제 방지)
    if (_stepChanged) scrollToCustomTop();
  }

  // ============================================
  // 이벤트 핸들러
  // ============================================
  
  function bindEvents() {
    const container = document.getElementById('wiawis-custom');
    if (!container) return;
    
    // Step 0: 커스텀 시작하기 → Step 1
    container.querySelectorAll('.btn-custom-start').forEach(btn => {
      btn.addEventListener('click', () => { state.currentStep = 1; render(); });
    });
    
    // Step 1: 모델 선택
    container.querySelectorAll('.model-card').forEach(card => {
      card.addEventListener('click', () => {
        const modelId = card.dataset.modelId;
        state.selected.model = state.config.models.find(m => m.id === modelId);
        state.selected.pattern = null; // 패턴 초기화
        state.currentStep = 2;
        render();
      });
    });
    
    // Step 2: 패턴 선택
    container.querySelectorAll('.pattern-card').forEach(card => {
      card.addEventListener('click', async () => {
        const patternId = card.dataset.patternId;
        const prevPatternId = state.selected.pattern ? state.selected.pattern.id : null;
        state.selected.pattern = {
          id: patternId,
          ...state.config.patterns[patternId]
        };
        
        // Step 3으로 가기 전에 이미지 프리로드
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-overlay';
        loadingEl.innerHTML = '이미지 로딩 중...';
        document.body.appendChild(loadingEl);
        
        await preloadModelImages(state.selected.model.id);
        
        loadingEl.remove();
        
        // Step 3 기본값: 패턴이 바뀌었거나 아직 색이 없을 때만 초기화 (같은 패턴 재선택 시 색 유지)
        if (prevPatternId !== patternId || !state.selected.style?.main?.color) {
          resetToDefaultStyle();
        }
        
        state.currentStep = 3;
        render();
      });
    });
    
    // Step 3: 탭 전환 (더 이상 사용 안 함)
    // container.querySelectorAll('.tab-btn').forEach(btn => { ... });
    
    // Step 3: 초기화 버튼 - config.json의 defaultStyle로 초기화
    container.querySelector('.btn-reset-small')?.addEventListener('click', () => {
      resetToDefaultStyle();
      render();
    });
    
    // Step 3: 파트 선택
    container.querySelectorAll('.part-card').forEach(card => {
      card.addEventListener('click', () => {
        state.ui.activePart = card.dataset.part;
        render();
      });
    });
    
    // Step 3: 마감 선택 (스타일) - 메인/서브 통일, 싯포스트/핸들바는 개별
    container.querySelectorAll('.option-btn[data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const part = state.ui.activePart;
        const newFinish = btn.dataset.finish;
        
        if (part === 'main' || part === 'sub') {
          // 메인/서브는 frameFinish로 통일
          state.selected.frameFinish = newFinish;
        } else {
          // 싯포스트/핸들바는 개별 적용
          state.selected.style[part].finish = newFinish;
        }
        
        // 마감 선택 시 현재 파트에 색상이 없으면 첫 번째 색상 자동 선택
        if (!state.selected.style[part].color) {
          state.selected.style[part].color = state.config.colors.frame[0];
        }
        
        render();
      });
    });
    
    // Step 3: FINISH 선택없음 (싯포스트/핸들바만)
    container.querySelector('[data-finish-none]')?.addEventListener('click', () => {
      const part = state.ui.activePart;
      state.selected.style[part].color = null;
      state.selected.style[part].pearl = false;
      render();
    });
    
    // Step 3: 색상 선택 (스타일)
    container.querySelectorAll('.color-swatch[data-color-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const part = state.ui.activePart;
        const colorId = btn.dataset.colorId;
        const color = state.config.colors.frame.find(c => c.id === colorId);
        state.selected.style[part].color = color;
        
        // pearlable 색상이면 자동으로 펄 적용, 아니면 펄 해제
        const isFramePart = part === 'main' || part === 'sub';
        {   // 파츠(싯포스트·핸들바) 포함 모든 파트
          state.selected.style[part].pearl = !!color.pearl;
        }
        
        render();
      });
    });
    
    // Step 3: 로고 타입 선택
    container.querySelectorAll('.logo-type-card').forEach(card => {
      card.addEventListener('click', () => {
        const typeId = card.dataset.logoType;
        state.selected.logo.type = state.config.logoTypes.find(t => t.id === typeId);
        render();
      });
    });
    
    // Step 3: 마감 선택 (로고)
    container.querySelectorAll('.option-btn[data-logo-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.logo.finish = btn.dataset.logoFinish;
        render();
      });
    });
    
    // Step 3: 색상 선택 (로고)
    container.querySelectorAll('.color-swatch[data-logo-color-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const colorId = btn.dataset.logoColorId;
        state.selected.logo.color = state.config.colors.logo.find(c => c.id === colorId);
        render();
      });
    });
    
    // 초기화 버튼
    container.querySelector('.btn-reset')?.addEventListener('click', () => {
      state.selected.style = {
        main: { color: null, finish: 'matte', pearl: null },
        sub: { color: null, finish: 'matte', pearl: null },
        seatpost: { color: null, finish: 'matte', pearl: null },
        handlebar: { color: null, finish: 'matte', pearl: null }
      };
      state.selected.logo = { type: null, color: null, finish: 'matte' };
      render();
    });
    
    // 다음/이전 버튼
    container.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentStep = parseInt(btn.dataset.step);
        render();
        if (state.currentStep === 0) scrollToCustomTop();
      });
    });
    
    // 경로 표시 클릭: 해당 단계로 이동 (⌂ 처음 = 인트로)
    container.querySelectorAll('.crumb-link').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentStep = parseInt(btn.dataset.gotoStep, 10);
        render();
        scrollToCustomTop();
      });
    });
    
    // PDF 다운로드
    container.querySelector('.btn-pdf')?.addEventListener('click', generatePDF);
    
    // 디자인 수정하기 (Step 3으로)
    container.querySelector('.btn-edit')?.addEventListener('click', () => {
      state.currentStep = 3;
      render();
    });
  }

  // ============================================
  // PDF 생성
  // ============================================
  
  async function generatePDF() {
    const { model, pattern, style, logo } = state.selected;
    const parts = state.config.parts;
    const finishes = state.config.finishes;
    
    const getFinishName = (id) => finishes.find(f => f.id === id)?.name || '';
    
    // 캔버스 이미지 가져오기
    const canvas = document.getElementById('preview-canvas');
    
    let imageData = '';
    try {
      imageData = canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Canvas toDataURL failed, using fallback');
      await new Promise(resolve => {
        renderPreview();
        setTimeout(resolve, 500);
      });
      try {
        imageData = canvas.toDataURL('image/png');
      } catch (e2) {
        console.error('Canvas export failed:', e2);
        imageData = '';
      }
    }
    
    const frameFinish = state.selected.frameFinish || 'gloss';
    
    // 스타일 HTML 미리 생성
    let styleItemsHTML = '';
    Object.entries(parts).forEach(function([partId, part]) {
      if (partId.startsWith('_')) return;
      const s = style[partId];
      if (!s || !s.color) return;
      
      const isFramePart = partId === 'main' || partId === 'sub';
      const partFinish = isFramePart ? frameFinish : (s.finish || 'gloss');
      const finishText = getFinishName(partFinish);
      const hasPearl = !!(s.pearl && s.color && s.color.pearl);   // 파츠 포함
      const pearlBadge = hasPearl ? '<span class="pearl-badge">✨ 펄</span>' : '';
      
      styleItemsHTML += '<div class="summary-item">' +
        '<span class="part-name">' + part.name + '</span>' +
        '<div class="color-info">' +
        '<span class="color-dot" style="background:' + getColorCss(s.color) + ';"></span>' +
        '<span>' + finishText + ' ' + s.color.name + pearlBadge + ' (' + getColorPantone(s.color) + ')</span>' +
        '</div></div>';
    });
    
    // 로고 HTML 미리 생성
    let logoHTML = '';
    if (logo.type) {
      const logoColorDot = logo.color ? 
        '<span class="color-dot" style="background:' + getColorCss(logo.color) + ';"></span>' : '';
      const logoColorText = logo.color ? 
        getFinishName(logo.finish) + ' ' + logo.color.name + ' (' + getColorPantone(logo.color) + ')' : '-';
      
      logoHTML = '<h2>로고타입</h2>' +
        '<div class="summary-item">' +
        '<span class="part-name">' + logo.type.name + '</span>' +
        '<div class="color-info">' + logoColorDot +
        '<span>' + logoColorText + '</span>' +
        '</div></div>';
    }
    
    // 이미지 HTML
    const imageHTML = imageData ? 
      '<div class="preview"><img src="' + imageData + '" alt="Preview"></div>' :
      '<div class="preview" style="padding:40px;color:#999;">이미지를 불러올 수 없습니다.</div>';
    
    // PDF 생성
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<!DOCTYPE html><html><head>' +
      '<title>WIAWIS Color Custom - ' + model.name + '</title>' +
      '<style>' +
      '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap");' +
      '@page{size:A4;margin:15mm}' +
      '*{box-sizing:border-box}' +
      'body{font-family:"Noto Sans KR",sans-serif;padding:0;margin:0;font-size:12px;line-height:1.4}' +
      '.container{max-width:100%;padding:10px}' +
      'h1{font-size:20px;margin:0 0 5px 0;color:#222}' +
      '.subtitle{font-size:14px;color:#666;margin-bottom:15px}' +
      '.preview{background:' + (state.config.background || '#faf8f4') + ';padding:15px;border-radius:8px;margin:10px 0;text-align:center}' +
      '.preview img{max-width:100%;max-height:280px;object-fit:contain}' +
      '.summary{margin-top:15px}' +
      '.summary h2{font-size:13px;font-weight:700;margin:15px 0 8px;padding-bottom:5px;border-bottom:2px solid #222}' +
      '.summary-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;font-size:11px}' +
      '.summary-item .part-name{font-weight:600;color:#333}' +
      '.color-info{display:flex;align-items:center;gap:6px}' +
      '.color-dot{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid #ccc;flex-shrink:0}' +
      '.pearl-badge{display:inline-block;background:linear-gradient(135deg,#ffd700,#ffec8b);color:#8b6914;font-size:9px;padding:1px 4px;border-radius:3px;margin-left:4px}' +
      '.footer{margin-top:20px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center}' +
      '@media print{body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.color-dot{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}' +
      '</style></head><body>' +
      '<div class="container">' +
      '<h1>WIAWIS Color Custom</h1>' +
      '<p class="subtitle">' + model.name + ' › ' + pattern.name + '</p>' +
      imageHTML +
      '<div class="summary"><h2>스타일</h2>' + styleItemsHTML + logoHTML + '</div>' +
      '<div class="footer">Generated by WIAWIS Color Custom System</div>' +
      '</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>' +
      '</body></html>');
    printWindow.document.close();
  }

  // ============================================
  // 초기화
  // ============================================
  
  async function init() {
    const container = document.getElementById('wiawis-custom');
    if (!container) {
      console.error('Container #wiawis-custom not found');
      return;
    }
    
    // 로딩 표시
    container.innerHTML = '<div class="loading">로딩 중...</div>';
    
    try {
      // config 로드
      state.config = await loadConfig();
      console.log('Config loaded:', state.config);
      
      // 렌더링
      render();
      
    } catch (error) {
      console.error('Init error:', error);
      container.innerHTML = '<div class="error">로딩 실패. 새로고침 해주세요.</div>';
    }
  }

  // 화면 크기 변경 시 레이아웃 업데이트
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (state.currentStep === 3) {
        render();
      }
    }, 150);
  });

  // DOM 준비되면 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
