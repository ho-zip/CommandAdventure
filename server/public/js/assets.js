/**
 * 에셋 키 → URL (파일이 없으면 CSS 플레이스홀더 사용)
 * 실제 이미지는 public/assets/ 아래에 배치하면 자동 로드 시도
 */
export const ASSET_KEYS = {
  CHR_01: 'assets/CHR_01.png',
  CHR_02: 'assets/CHR_02.png',
  MON_01: 'assets/MON_01.png',
  MON_02: 'assets/MON_02.png',
  OBJ_01: 'assets/OBJ_01.png',
  OBJ_02: 'assets/OBJ_02.png',
  OBJ_03: 'assets/OBJ_03.png',
  OBJ_04: 'assets/OBJ_04.png',
  OBJ_05: 'assets/OBJ_05.png',
  ITC_01: 'assets/ITC_01.png',
  ITC_02: 'assets/ITC_02.png',
  ITC_03: 'assets/ITC_03.png',
  ITC_04: 'assets/ITC_04.png',
  ITC_05: 'assets/ITC_05.png',
  ITC_06: 'assets/ITC_06.png',
  TLS_01: 'assets/TLS_01.jpg',
  TLS_02: 'assets/TLS_02.jpg',
  UI_01: 'assets/UI_01.png',
  UI_02: 'assets/UI_02.png',
};

const objectTypeToAsset = {
  tree: 'OBJ_01',
  tree_stump: 'OBJ_02',
  ore: 'OBJ_03',
  ore_depleted: 'OBJ_04',
  anvil: 'OBJ_05',
  anvil_destroyed: 'OBJ_05',
  dragon: 'MON_01',
  dragon_defeated: 'MON_01',
  demon: 'MON_02',
  demon_defeated: 'MON_02',
  portal: 'TLS_02',
};

const cache = new Map();

export function getObjectAssetKey(type) {
  return objectTypeToAsset[type] ?? 'OBJ_01';
}

function tryLoadPath(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

/** 타일 텍스처: .jpg 우선, 없으면 .png 시도 */
function pathsForKey(key, primaryPath) {
  if (key === 'TLS_01') return ['assets/TLS_01.jpg', 'assets/TLS_01.png'];
  if (key === 'TLS_02') return ['assets/TLS_02.jpg', 'assets/TLS_02.png'];
  return [primaryPath];
}

export async function preloadAssets(onProgress) {
  const entries = Object.entries(ASSET_KEYS);
  let done = 0;
  const total = entries.length;
  for (const [key, primaryPath] of entries) {
    const paths = pathsForKey(key, primaryPath);
    let loaded = null;
    let used = primaryPath;
    for (const p of paths) {
      const img = await tryLoadPath(p);
      if (img) {
        loaded = img;
        used = p;
        break;
      }
    }
    if (loaded) {
      cache.set(key, loaded);
      ASSET_KEYS[key] = used;
    } else {
      cache.set(key, null);
    }
    done += 1;
    onProgress?.(done / total);
  }
}

export function getImage(key) {
  return cache.get(key) ?? null;
}
