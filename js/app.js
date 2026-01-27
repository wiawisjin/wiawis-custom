/**
 * WIAWIS Color Custom System
 * Version: 1.4.0
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
    currentStep: 1,
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
    
    // 패턴별 마스크 (유광/무광 각각)
    model.patterns.forEach(patternId => {
      const pattern = state.config.patterns[patternId];
      pattern.layers.forEach(layer => {
        finishes.forEach(finish => {
          imagesToLoad.push(`${basePath}/patterns/${patternId}/${finish}/${layer}.png`);
        });
      });
    });
    
    // 로고
    state.config.logoTypes.forEach(lt => {
      imagesToLoad.push(`${basePath}/logos/matte/${lt.id}.png`);
      imagesToLoad.push(`${basePath}/logos/gloss/${lt.id}.png`);
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
  // 펄 효과 시스템
  // ============================================
  
  // 펄 파티클 저장소
  let pearlParticles = [];
  let pearlAnimationId = null;
  let pearlBaseImage = null; // 펄 효과 전 기본 이미지 저장
  
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
  
  // 펄 스파클 생성 (빽빽하고 잘 보이게)
  function generatePearlParticles(pixels, count = 5000) {
    const particles = [];
    if (pixels.length === 0) return particles;
    
    // 스파클 색상 팔레트
    const colors = [
      '#ffffff',  // 순백
      '#ffffff',  // 순백 (비중 높임)
      '#fffef8',  // 크림
      '#f8fcff',  // 블루틴트
      '#fff8f8',  // 핑크틴트
    ];
    
    for (let i = 0; i < count; i++) {
      const pixel = pixels[Math.floor(Math.random() * pixels.length)];
      particles.push({
        x: pixel.x + (Math.random() - 0.5) * 1,
        y: pixel.y + (Math.random() - 0.5) * 1,
        size: Math.random() * 0.6 + 0.4,  // 0.4 ~ 1.0px
        maxOpacity: Math.random() * 0.4 + 0.6,  // 0.6 ~ 1.0 (더 밝게)
        baseOpacity: Math.random() * 0.15 + 0.05,  // 0.05 ~ 0.2 (항상 약간 보임)
        speed: Math.random() * 4 + 2,  // 반짝임 속도
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: Math.random() > 0.95 ? 'cross' : 'dot'  // 5%만 십자가
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
    
    // 스파클 그리기 (빽빽하게)
    pearlParticles.forEach(p => {
      // 반짝임 계산 (부드러운 펄스 + 항상 약간 보임)
      const wave = Math.sin(time * p.speed + p.phase);
      const twinkle = Math.pow(Math.max(0, wave), 1.5);  // 1.5제곱 (부드럽게)
      const alpha = p.baseOpacity + (p.maxOpacity - p.baseOpacity) * twinkle;
      
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
      
      // 1. 흰색 배경
      offCtx.fillStyle = '#f5f5f5';
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
          const maskPath = `${basePath}/patterns/${pattern.id}/${finish}/${layer}.png`;
          let maskImg = getCachedImage(maskPath);
          if (!maskImg) {
            try {
              maskImg = await loadImage(maskPath);
              state.images[maskPath] = maskImg;
            } catch (e) { continue; }
          }
          applyColorToMask(offCtx, maskImg, partStyle.color.hex, offscreen.width, offscreen.height);
          
          // 펄 적용 체크: 해당 파트에 pearl=true이고, pearlable 색상일 때만
          const hasPearl = partStyle.pearl === true;
          const isPearlable = partStyle.color.pearlable === true;
          
          console.log(`[Pearl] ${layer}: pearl=${hasPearl}, pearlable=${isPearlable}`);
          
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
          applyColorToMask(offCtx, seatpostImg, style.seatpost.color.hex, offscreen.width, offscreen.height);
          // 싯포스트는 펄 효과 제외 (메인/서브만 적용)
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
          applyColorToMask(offCtx, handlebarImg, style.handlebar.color.hex, offscreen.width, offscreen.height);
          // 핸들바는 펄 효과 제외 (메인/서브만 적용)
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
          applyColorToMask(offCtx, logoImg, logo.color.hex, offscreen.width, offscreen.height);
        }
      }
      
      // 최종: 메인 캔버스에 한 번에 복사 (번쩍임 없음)
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(offscreen, 0, 0);
      
      // 펄 효과가 있으면 애니메이션 시작 (메인/서브만, 각각 개별 체크)
      if (pearlMasks.length > 0) {
        console.log(`[Pearl] Masks with pearl: ${pearlMasks.length}`, pearlMasks.map(m => m.layer));
        console.log(`[Pearl] Masks without pearl: ${nonPearlMasks.length}`, nonPearlMasks.map(m => m.layer));
        
        // 기본 이미지 저장 (애니메이션에서 매 프레임 복원용)
        pearlBaseImage = document.createElement('canvas');
        pearlBaseImage.width = canvas.width;
        pearlBaseImage.height = canvas.height;
        pearlBaseImage.getContext('2d').drawImage(offscreen, 0, 0);
        
        // 마스크 구조 특성:
        // - main.png = 전체 프레임 (sub 영역 포함)
        // - sub.png = 서브 영역만
        // 따라서 차집합은 "메인 펄 O, 서브 펄 X"일 때만 필요
        
        const hasMainPearl = pearlMasks.some(m => m.layer === 'main');
        const hasSubPearl = pearlMasks.some(m => m.layer === 'sub');
        const hasSubNonPearl = nonPearlMasks.some(m => m.layer === 'sub');
        
        let finalPixels = [];
        
        if (hasMainPearl && hasSubNonPearl) {
          // 케이스 1: 메인 펄 O, 서브 펄 X → main - sub
          console.log('[Pearl] Case: Main pearl only, subtract sub');
          
          const mainMask = pearlMasks.find(m => m.layer === 'main');
          const subMask = nonPearlMasks.find(m => m.layer === 'sub');
          
          const mainPixels = extractMaskPixels(mainMask.img, canvas.width, canvas.height);
          const subPixels = extractMaskPixels(subMask.img, canvas.width, canvas.height);
          
          // sub 픽셀을 Set으로 변환
          const subPixelSet = new Set(subPixels.map(p => `${p.x},${p.y}`));
          
          // 차집합: main - sub
          finalPixels = mainPixels.filter(p => !subPixelSet.has(`${p.x},${p.y}`));
          console.log(`[Pearl] main(${mainPixels.length}) - sub(${subPixels.length}) = ${finalPixels.length}`);
          
        } else if (hasSubPearl && !hasMainPearl) {
          // 케이스 2: 서브 펄만 O → sub만 사용 (차집합 불필요)
          console.log('[Pearl] Case: Sub pearl only, no subtract needed');
          
          const subMask = pearlMasks.find(m => m.layer === 'sub');
          finalPixels = extractMaskPixels(subMask.img, canvas.width, canvas.height);
          console.log(`[Pearl] Using sub pixels: ${finalPixels.length}`);
          
        } else if (hasMainPearl && hasSubPearl) {
          // 케이스 3: 둘 다 펄 O → main만 사용 (sub는 main에 포함)
          console.log('[Pearl] Case: Both pearl, using main only');
          
          const mainMask = pearlMasks.find(m => m.layer === 'main');
          finalPixels = extractMaskPixels(mainMask.img, canvas.width, canvas.height);
          console.log(`[Pearl] Using main pixels: ${finalPixels.length}`);
          
        } else {
          // 기타 케이스: 모든 펄 마스크 사용
          console.log('[Pearl] Case: Default, using all pearl masks');
          for (const maskData of pearlMasks) {
            const pixels = extractMaskPixels(maskData.img, canvas.width, canvas.height);
            finalPixels = finalPixels.concat(pixels);
          }
        }
        
        // 로고 영역 제외 (펄이 로고 위에 렌더링되지 않도록)
        if (logo.type && finalPixels.length > 0) {
          const logoFinishType = state.config.finishes.find(f => f.id === logo.finish)?.type || 'matte';
          const logoPath = `assets/models/${model.id}/logos/${logoFinishType}/${logo.type.id}.png`;
          let logoMaskImg = getCachedImage(logoPath);
          
          if (!logoMaskImg) {
            try {
              logoMaskImg = await loadImage(logoPath);
              state.images[logoPath] = logoMaskImg;
            } catch (e) {
              console.warn('[Pearl] Could not load logo mask for exclusion');
            }
          }
          
          if (logoMaskImg) {
            const logoPixels = extractMaskPixels(logoMaskImg, canvas.width, canvas.height);
            if (logoPixels.length > 0) {
              const logoPixelSet = new Set(logoPixels.map(p => `${p.x},${p.y}`));
              const beforeCount = finalPixels.length;
              finalPixels = finalPixels.filter(p => !logoPixelSet.has(`${p.x},${p.y}`));
              console.log(`[Pearl] Excluding logo area: ${beforeCount} - ${logoPixels.length} = ${finalPixels.length}`);
            }
          }
        }
        
        // 매우 많은 스파클 생성 (5000~10000개)
        const sparkleCount = Math.min(Math.max(finalPixels.length * 0.1, 5000), 10000);
        pearlParticles = generatePearlParticles(finalPixels, sparkleCount);
        console.log(`[Pearl] Generated ${pearlParticles.length} sparkles from ${finalPixels.length} pixels`);
        
        // 애니메이션 시작
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
    const totalSteps = 4;
    const currentStep = state.currentStep;
    
    // 진행률 계산 (각 스텝당 25%)
    const segments = [];
    for (let i = 1; i <= totalSteps; i++) {
      let status = '';
      if (i < currentStep) status = 'done';
      else if (i === currentStep) status = 'active';
      segments.push(`<div class="step-segment ${status}"></div>`);
    }
    
    return `
      <div class="step-bar">
        <div class="step-bar-inner">
          ${segments.join('')}
        </div>
      </div>
    `;
  }

  // Step 1: 모델 선택
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
        <div class="step-header">
          <h2 class="step-title">STEP 1</h2>
          <p class="step-subtitle">모델을 선택해 주세요</p>
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
        <div class="step-header">
          <h2 class="step-title">STEP 2</h2>
          <p class="step-subtitle">디자인을 선택해 주세요</p>
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
        <div class="step-header">
          <h2 class="step-title">STEP 3</h2>
          <p class="step-subtitle">컬러를 선택해 주세요</p>
          ${renderStepBar()}
        </div>
        
        <div class="step3-breadcrumb">
          <span>${model.name}</span>
          <span class="breadcrumb-separator">›</span>
          <span>${pattern.name}</span>
          <button class="btn-reset-small">↻ 초기화</button>
        </div>
        
        <div class="step3-layout">
          <!-- 프리뷰 -->
          <div class="preview-section">
            <canvas id="preview-canvas"></canvas>
          </div>
          
          <!-- 컨트롤 -->
          <div class="control-section">
            
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
                  const hasPearl = partIsFrame && partStyle?.pearl;
                  const partFinish = partIsFrame ? (state.selected.frameFinish || 'matte') : (partStyle?.finish || 'matte');
                  const finishName = hasColor ? finishes.find(f => f.id === partFinish)?.name || '' : '';
                  const pearlText = hasPearl ? ' ✨' : '';
                  // 모든 파트 썸네일은 parts 폴더에서
                  const imgPath = `assets/models/${model.id}/patterns/${pattern.id}/parts/${partId}.png`;
                  const cardBorder = isActive ? '2px solid #7359dc' : '1px solid #ebebeb';
                  const cardBg = hasPearl ? 'linear-gradient(135deg,#fffde7,#fff8e1)' : '#fff';
                  return `
                    <div class="part-card ${isActive ? 'active' : ''} ${hasColor ? 'has-color' : ''}" data-part="${partId}"
                         style="border:${cardBorder};border-radius:12px;padding:8px;width:130px;text-align:center;cursor:pointer;background:${cardBg};${hasPearl ? 'box-shadow:0 0 8px rgba(255,215,0,0.3);' : ''}">
                      <h6 style="font-size:0.75rem;font-weight:600;color:#333;margin:0 0 5px 0;">${part.name}${hasPearl ? '✨' : ''}</h6>
                      <div class="part-preview" style="width:110px;height:90px;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">
                        <img src="${getImageUrl(imgPath)}"
                             alt="${part.name}"
                             style="max-height:80px;max-width:100%;object-fit:contain;"
                             onerror="this.style.opacity='0.3'">
                      </div>
                      <div class="part-status" style="font-size:0.65rem;color:#666;min-height:28px;line-height:1.3;">
                        ${hasColor 
                          ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${partStyle.color.hex};vertical-align:middle;margin-right:3px;${hasPearl ? 'box-shadow:0 0 4px rgba(255,215,0,0.8);animation:pearlPulse 1.5s infinite;' : ''}"></span>
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
              
              <!-- PEARL (펄 추가) - 메인/서브 + 펄 가능 색상일 때만 표시 -->
              ${(() => {
                // 메인/서브가 아니면 펄 버튼 숨김
                if (validActivePart !== 'main' && validActivePart !== 'sub') return '';
                
                const selectedColor = style[validActivePart]?.color;
                const hasPearl = style[validActivePart]?.pearl;
                if (!selectedColor?.pearlable) return '';
                
                const btnBg = hasPearl ? '#222' : '#f0f0f0';
                const btnBorder = hasPearl ? '#222' : '#ccc';
                const textColor = hasPearl ? '#fff' : '#222';
                
                return `
                <div class="option-row" style="margin-bottom:20px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <span class="option-label" style="font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin:0;">PEARL</span>
                    <span style="font-size:0.65rem;color:#888;font-weight:400;">(${selectedColor.name}색상은 펄 적용 가능)</span>
                  </div>
                  <div class="option-buttons" style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="pearl-toggle ${hasPearl ? 'selected' : ''}"
                            style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:${btnBg};border:2px solid ${btnBorder};border-radius:18px;cursor:pointer;">
                      <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#fff 0%,#ffd700 50%,#fff 100%);border:1px solid #ccc;${hasPearl ? 'animation:pearlPulse 1s infinite;' : ''}"></span>
                      <span style="color:${textColor};font-size:0.85rem;font-weight:600;">펄 추가</span>
                    </button>
                    ${hasPearl ? '<span style="font-size:0.75rem;color:#f57c00;margin-left:8px;">화면의 펄 효과는 참고용이며, 실제 제품과는 다를 수 있습니다.</span>' : ''}
                  </div>
                </div>
                `;
              })()}
              
              <!-- COLORS -->
              <div class="option-row" style="margin-bottom:0;">
                <span class="option-label" style="display:block;font-size:0.8rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">COLORS</span>
                <div class="color-grid ${isGloss ? 'gloss-mode' : ''}" style="display:grid;grid-template-columns:repeat(10, 1fr);gap:6px;">
                  ${frameColors.map(c => {
                    const isColorSelected = style[validActivePart]?.color?.id === c.id;
                    // 펄 효과는 메인/서브일 때만
                    const hasPearlEffect = isFramePart && isColorSelected && style[validActivePart]?.pearl;
                    const swatchBorder = isColorSelected ? '2px solid #222' : '2px solid rgba(0,0,0,0.12)';
                    const swatchShadow = hasPearlEffect 
                      ? '0 0 0 2px #fff, 0 0 0 4px #ffd700, 0 0 12px rgba(255,215,0,0.6)' 
                      : (isColorSelected ? '0 0 0 2px #fff, 0 0 0 3px #222' : 'none');
                    // 펄 가능 표시도 메인/서브일 때만
                    const pearlIndicator = (isFramePart && c.pearlable) ? '<span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:linear-gradient(135deg,#fff,#ffd700,#fff);border-radius:50%;border:1px solid #ccc;"></span>' : '';
                    return `
                    <div class="color-item" style="display:flex;flex-direction:column;align-items:center;position:relative;">
                      <button class="color-swatch ${isGloss ? 'gloss' : ''} ${isColorSelected ? 'selected' : ''}"
                              style="width:26px;height:26px;border-radius:50%;background:${c.hex};border:${swatchBorder};cursor:pointer;box-shadow:${swatchShadow};position:relative;${hasPearlEffect ? 'animation:pearlPulse 1.5s ease-in-out infinite;' : ''}"
                              data-color-id="${c.id}">
                        ${pearlIndicator}
                      </button>
                      <span class="color-name" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:0.55rem;color:#666;white-space:nowrap;margin-top:2px;opacity:${isColorSelected ? '1' : '0'};">${c.name}${hasPearlEffect ? ' ✨' : ''}</span>
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
                  const logoBorder = isLogoActive ? '2px solid #7359dc' : '1px solid #ebebeb';
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
                  <div class="color-grid ${logo.finish === 'gloss' ? 'gloss-mode' : ''}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(32px,1fr));gap:6px;max-width:200px;">
                    ${logoColors.map(c => {
                      const isLogoColorSelected = logo.color?.id === c.id;
                      const swatchBorder = isLogoColorSelected ? '2px solid #222' : '2px solid rgba(0,0,0,0.12)';
                      const swatchShadow = isLogoColorSelected ? '0 0 0 2px #fff, 0 0 0 3px #222' : 'none';
                      return `
                      <div class="color-item" style="display:flex;flex-direction:column;align-items:center;position:relative;">
                        <button class="color-swatch ${logo.finish === 'gloss' ? 'gloss' : ''} ${isLogoColorSelected ? 'selected' : ''}"
                                style="width:26px;height:26px;border-radius:50%;background:${c.hex};border:${swatchBorder};cursor:pointer;box-shadow:${swatchShadow};"
                                data-logo-color-id="${c.id}">
                        </button>
                        <span class="color-name" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:0.55rem;color:#666;white-space:nowrap;margin-top:2px;opacity:${isLogoColorSelected ? '1' : '0'};">${c.name}</span>
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
          pearl: isFramePart && partStyle.pearl  // 펄 여부 추가
        };
      });
    
    return `
      <div class="step-container step-4">
        <div class="step-header">
          <h2 class="step-title">STEP 4</h2>
          <p class="step-subtitle">디자인을 확인해 주세요</p>
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
                      <span class="color-dot" style="background:${s.color.hex}"></span>
                      <span class="finish-text">${getFinishName(s.finish)}</span>
                      <span class="color-name">${s.color.name}${s.pearl ? ' <span class="pearl-badge">✨ 펄</span>' : ''}</span>
                      <span class="pantone-code">(${s.color.pantone})</span>
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
                        <span class="color-dot" style="background:${logo.color.hex}"></span>
                        <span class="finish-text">${getFinishName(logo.finish)}</span>
                        <span class="color-name">${logo.color.name}</span>
                        <span class="pantone-code">(${logo.color.pantone || '-'})</span>
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
  function render() {
    const container = document.getElementById('wiawis-custom');
    if (!container) return;
    
    let html = '';
    
    switch (state.currentStep) {
      case 1: html = renderStep1(); break;
      case 2: html = renderStep2(); break;
      case 3: html = renderStep3(); break;
      case 4: html = renderStep4(); break;
    }
    
    container.innerHTML = html;
    
    // 프리뷰 렌더링 (Step 3, 4)
    if (state.currentStep >= 3) {
      setTimeout(renderPreview, 100);
    }
    
    // 이벤트 바인딩
    bindEvents();
  }

  // ============================================
  // 이벤트 핸들러
  // ============================================
  
  function bindEvents() {
    const container = document.getElementById('wiawis-custom');
    if (!container) return;
    
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
        
        // Step 3 기본값 설정: config.json의 defaultStyle 사용
        resetToDefaultStyle();
        
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
    
    // Step 3: 펄 옵션 토글
    container.querySelectorAll('.pearl-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const part = state.ui.activePart;
        state.selected.style[part].pearl = !state.selected.style[part].pearl;
        render();
      });
    });
    
    // Step 3: 색상 선택 (스타일)
    container.querySelectorAll('.color-swatch[data-color-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const part = state.ui.activePart;
        const colorId = btn.dataset.colorId;
        const color = state.config.colors.frame.find(c => c.id === colorId);
        state.selected.style[part].color = color;
        // 펄 불가능한 색상이면 펄 초기화
        if (!color.pearlable) {
          state.selected.style[part].pearl = false;
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
      const hasPearl = isFramePart && s.pearl;
      const pearlBadge = hasPearl ? '<span class="pearl-badge">✨ 펄</span>' : '';
      
      styleItemsHTML += '<div class="summary-item">' +
        '<span class="part-name">' + part.name + '</span>' +
        '<div class="color-info">' +
        '<span class="color-dot" style="background-color:' + s.color.hex + ';"></span>' +
        '<span>' + finishText + ' ' + s.color.name + pearlBadge + ' (' + s.color.pantone + ')</span>' +
        '</div></div>';
    });
    
    // 로고 HTML 미리 생성
    let logoHTML = '';
    if (logo.type) {
      const logoColorDot = logo.color ? 
        '<span class="color-dot" style="background-color:' + logo.color.hex + ';"></span>' : '';
      const logoColorText = logo.color ? 
        getFinishName(logo.finish) + ' ' + logo.color.name + ' (' + (logo.color.pantone || '-') + ')' : '-';
      
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
      '.preview{background:#f5f5f5;padding:15px;border-radius:8px;margin:10px 0;text-align:center}' +
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
