import { Injectable } from '@nestjs/common';

/**
 * Cache em memória — stand-in local para o Redis (não há Docker/Redis
 * disponível nesta máquina). Interface pensada para troca fácil por
 * `ioredis` em produção: bastaria reimplementar get/set/del usando um
 * client Redis real, sem mudar quem consome este serviço.
 */
@Injectable()
export class CacheService {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = 30): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  /** Remove todas as chaves que começam com o prefixo dado (ex.: invalidar listas após uma escrita). */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
