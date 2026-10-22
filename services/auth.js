import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_DURATION = 8 * 60 * 60 * 1000;
export const HOME_BY_ROLE = {
  Recepcionista: '/recepcao/recepcao.html',
  Enfermeiro: '/triagem/triagem.html',
  Medico: '/medico/medico.html'
};

export async function hashPassword(password, { legacy = false } = {}) {
  if (typeof password !== 'string' || password.length < (legacy ? 1 : 8) || password.length > 128) {
    throw Object.assign(new Error('A senha deve ter entre 8 e 128 caracteres'), { code: 'INVALID_DATA' });
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || typeof stored !== 'string') return false;
  if (!stored.startsWith('scrypt$')) {
    // Compatibilidade temporária com os dados de demonstração; o login troca a senha por hash.
    const actual = Buffer.from(password);
    const expected = Buffer.from(stored);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  const [, salt, hash] = stored.split('$');
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

export function createAuth(repository) {
  const sessions = new Map();
  const attempts = new Map();
  function prune(map) {
    const now = Date.now();
    for (const [key, value] of map) if (value.expires <= now) map.delete(key);
  }
  function token(req) {
    return req.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('ps_session='))?.slice('ps_session='.length);
  }
  function cookieOptions(req) {
    return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' };
  }
  return {
    async load(req, _res, next) {
      try {
        prune(sessions);
        const session = sessions.get(token(req));
        if (session) {
          const user = await repository.buscarPorId('profissionais', session.id);
          if (user?.ativo && Object.hasOwn(HOME_BY_ROLE, user.cargo)) req.user = user;
          else sessions.delete(token(req));
        }
        next();
      } catch (error) { next(error); }
    },
    limit(req, res, next) {
      prune(attempts);
      const key = req.ip;
      const entry = attempts.get(key) || { count: 0, expires: Date.now() + 15 * 60 * 1000 };
      entry.count++;
      attempts.set(key, entry);
      if (entry.count > 30) {
        res.set('Retry-After', String(Math.ceil((entry.expires - Date.now()) / 1000)));
        return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' });
      }
      next();
    },
    start(req, res, user) {
      prune(sessions);
      sessions.delete(token(req));
      const value = randomBytes(32).toString('hex');
      sessions.set(value, { id: user.id_profissional, expires: Date.now() + SESSION_DURATION });
      res.cookie('ps_session', value, { ...cookieOptions(req), maxAge: SESSION_DURATION });
    },
    logout(req, res) {
      sessions.delete(token(req));
      res.clearCookie('ps_session', cookieOptions(req));
    }
  };
}
