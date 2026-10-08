import crypto from 'crypto'
import bcrypt from 'bcrypt'

export function generateToken() {
    return crypto.randomBytes(32).toString('hex'); // 64 chars
}

const SALT_ROUNDS = 12
export async function hashToken(token) {
    return bcrypt.hash(token, SALT_ROUNDS);
}

export async function verifyToken(token, tokenHash) {
    return bcrypt.compare(token, tokenHash);
}
