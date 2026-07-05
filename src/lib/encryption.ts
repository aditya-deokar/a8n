import Cryptr from "cryptr";
import { env } from "@/env";

const cryptr = new Cryptr(env.ENCRYPTION_KEY);

export const encrypt = (text: string) => cryptr.encrypt(text);
export const decrypt = (text: string) => cryptr.decrypt(text);
