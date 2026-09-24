/**
 * Secure key/value storage backed by the Asset Store Kit (@ohos.security.asset).
 * Values are encrypted at rest by the system; no extra permission is needed.
 * Mirrors the slice of expo-secure-store the app uses (write/read/delete of
 * string tokens). The JS side falls back to session-only memory when this
 * module is absent (e.g. Metro reload against an old HAP).
 */
import { AnyThreadTurboModule } from '@rnoh/react-native-openharmony/ts';
import type { AnyThreadTurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { asset } from '@kit.AssetStoreKit';
import { util } from '@kit.ArkTS';

const KEY_PREFIX = 'multica.secure.';

function toBytes(value: string): Uint8Array {
  return new util.TextEncoder().encodeInto(value);
}

function fromBytes(value: Uint8Array): string {
  return new util.TextDecoder().decodeWithStream(value);
}

function aliasQuery(alias: Uint8Array): asset.AssetMap {
  const query: asset.AssetMap = new Map();
  query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
  query.set(asset.Tag.ALIAS, alias);
  return query;
}

export class MulticaSecureStorageModule extends AnyThreadTurboModule {
  constructor(protected ctx: AnyThreadTurboModuleContext) {
    super(ctx);
  }

  async set(key: string, value: string): Promise<boolean> {
    const alias = toBytes(KEY_PREFIX + key);
    try {
      const existing = await this.readSecret(alias);
      if (existing !== null) {
        const attrs: asset.AssetMap = new Map();
        attrs.set(asset.Tag.SECRET, toBytes(value));
        await asset.update(aliasQuery(alias), attrs);
      } else {
        const attrs: asset.AssetMap = new Map();
        attrs.set(asset.Tag.ALIAS, alias);
        attrs.set(asset.Tag.SECRET, toBytes(value));
        await asset.add(attrs);
      }
      return true;
    } catch (e) {
      console.error(`[MulticaSecureStorage] set failed: ${JSON.stringify(e)}`);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.readSecret(toBytes(KEY_PREFIX + key));
    } catch (e) {
      console.error(`[MulticaSecureStorage] get failed: ${JSON.stringify(e)}`);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      await asset.remove(aliasQuery(toBytes(KEY_PREFIX + key)));
    } catch (e) {
      // Removing a missing alias is a no-op, not a failure.
    }
    return true;
  }

  private async readSecret(alias: Uint8Array): Promise<string | null> {
    const result: Array<asset.AssetMap> = await asset.query(aliasQuery(alias));
    for (const item of result) {
      const secret = item.get(asset.Tag.SECRET);
      if (secret !== undefined) {
        return fromBytes(secret as Uint8Array);
      }
    }
    return null;
  }
}
