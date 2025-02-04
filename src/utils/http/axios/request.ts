import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ContentTypeEnum } from '@/enums/httpEnum';
import { getInitConfig } from '@/utils/initConfig';
import { EncryptionFactory } from '@/utils/cipher';
import { Api } from '@/api/sys/model/route';
import { Result } from '#/axios';
import { buildUUID } from '@/utils/uuid';
import { log } from '@/utils/log';
import { useLocaleStoreWithOut } from '@/store/modules/locale';

const requestCache = new Map<string, string>();

export function encryptRequest(config: InternalAxiosRequestConfig) {
  const localeStore = useLocaleStoreWithOut();
  const aes = EncryptionFactory.createAesEncryption();
  const rsa = EncryptionFactory.createRsaEncryption();

  const { encryptionEnabled, publicKey } = getInitConfig();

  if (encryptionEnabled) {
    aes.setIvConcat(true).setKey().setIv();
    const requestId = buildUUID();
    requestCache.set(requestId, aes.getKey());
    config.headers['X-Request-ID'] = requestId;
    if (publicKey) {
      rsa.setKey(publicKey);
      config.headers['X-AES-KEY'] = rsa.encrypt(aes.getKey());
    } else {
      config.headers['X-AES-KEY'] = aes.getKey();
    }
    if (config.url?.includes(Api.FileUpload)) {
      config.data.append('data', aes.encrypt(JSON.stringify(config.uploadParams)));
      config.headers['Content-Type'] = ContentTypeEnum.FORM_DATA;
    } else {
      config.headers['Content-Type'] = ContentTypeEnum.JSON;
      config.data = { data: aes.encrypt(JSON.stringify(config.data)) };
    }
    //设置语言包
    config.headers['Accept-Language'] = localeStore.getLocale;
  }
  return config;
}

export function decryptResponse(res: AxiosResponse<Result>) {
  const requestId = res.config.headers['X-Request-ID'] as string;
  const aesKey = requestCache.get(requestId);
  if (!aesKey) {
    throw new Error('AES Key not found for the response');
  }
  const aes = EncryptionFactory.createAesEncryption(); // Create a new instance
  log(aes.getKey());
  aes.setKey(aesKey);
  log(aes.getKey());
  const { encryptionEnabled } = getInitConfig();

  if (encryptionEnabled) {
    res.data.data = JSON.parse(aes.decrypt(res.data.data));
  }
  log(res.data.data);
  return res.data.data;
}
