import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt=promisify(scryptCallback);
const KEY_LENGTH=64;
const SCRYPT_OPTIONS={N:16384,r:8,p:1,maxmem:64*1024*1024};

export function validatePasswordPolicy(password){
  const value=String(password||"");
  const classes=[/[a-z]/.test(value),/[A-Z]/.test(value),/\d/.test(value),/[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  if(value.length<12)throw new Error("Password must contain at least 12 characters");
  if(classes<3)throw new Error("Password must include at least 3 of: lowercase, uppercase, number, symbol");
  return value;
}

export async function hashPassword(password){
  validatePasswordPolicy(password);
  const salt=randomBytes(16).toString("base64url");
  const derived=await scrypt(password,salt,KEY_LENGTH,SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password,storedHash){
  try{
    const [algorithm,n,r,p,salt,encoded]=String(storedHash||"").split("$");
    if(algorithm!=="scrypt"||!salt||!encoded)return false;
    const expected=Buffer.from(encoded,"base64url");
    const derived=Buffer.from(await scrypt(String(password||""),salt,expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:64*1024*1024}));
    return expected.length===derived.length&&timingSafeEqual(expected,derived);
  }catch{return false}
}

export async function consumeComparableDelay(password){
  await scrypt(String(password||""),"authentication-delay",KEY_LENGTH,SCRYPT_OPTIONS);
}

export function createPasswordResetToken(){
  const token=randomBytes(32).toString("base64url");
  return{token,tokenHash:hashResetToken(token)};
}
export function hashResetToken(token){return createHash("sha256").update(String(token||"")).digest("hex")}

