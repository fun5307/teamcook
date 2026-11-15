// 요금제·엔진 정보는 providers.json 한 곳에만 둔다. 바뀌면 그 파일만 고친다.
import type { ProviderData } from '../types';
import raw from './providers.json';

export const providerData = raw as unknown as ProviderData;
