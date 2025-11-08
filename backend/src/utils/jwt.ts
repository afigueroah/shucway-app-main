// Normaliza la importación de jsonwebtoken para evitar "jwt.sign is not a function"
import jwtModule from 'jsonwebtoken';

// Si el bundler expone default, úsalo; si no, usa el módulo como objeto.
export const jwt = jwtModule;

// Tipos útiles (opcional)
export type JwtSign = typeof jwtModule.sign;
export type JwtVerify = typeof jwtModule.verify;
