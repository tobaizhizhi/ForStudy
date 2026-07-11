import { getAddress, type Address } from "viem";
import { ADDRESSES, printKV, runIfMain, section } from "./shared.js";

const SIG_VALIDATION_SUCCESS = 0n;
const SIG_VALIDATION_FAILED = 1n;

interface UnpackedValidationData {
  authorizer: bigint;
  validUntil: bigint;
  validAfter: bigint;
}

function packValidationData(authorizer: bigint, validUntil: bigint, validAfter: bigint): bigint {
  return authorizer | (validUntil << 160n) | (validAfter << 208n);
}

function unpackValidationData(validationData: bigint): UnpackedValidationData {
  const authorizerMask = (1n << 160n) - 1n;
  const timeMask = (1n << 48n) - 1n;
  return {
    authorizer: validationData & authorizerMask,
    validUntil: (validationData >> 160n) & timeMask,
    validAfter: (validationData >> 208n) & timeMask,
  };
}

function addressToUint160(address: Address): bigint {
  return BigInt(getAddress(address));
}

function explain(label: string, value: bigint): void {
  const unpacked = unpackValidationData(value);
  console.log(`\n${label}`);
  printKV("validationData", value);
  printKV("低 160 位 authorizer", unpacked.authorizer);
  printKV("[160,208) validUntil", unpacked.validUntil);
  printKV("[208,256) validAfter", unpacked.validAfter);
}

export function runDemo(): void {
  section("练习 2：validationData 怎么同时表达“签名状态”和“有效期”");

  explain("A. owner / session key 验签成功，且不设置时间窗", SIG_VALIDATION_SUCCESS);
  explain("B. 签名无效：低 160 位最低位为 1", SIG_VALIDATION_FAILED);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = now + 60n;
  const validUntil = now + 7n * 24n * 60n * 60n;
  explain("C. session key 1 分钟后生效，7 天后过期", packValidationData(0n, validUntil, validAfter));

  explain(
    "D. 聚合签名 / authorizer 场景：低 160 位可以放一个地址",
    packValidationData(addressToUint160(ADDRESSES.implementation), validUntil, validAfter),
  );

  console.log("\n记忆方式：");
  console.log("低 160 位回答：谁来证明签名有效？0=账户自己验过了，1=签名失败，地址=交给某个 aggregator/authorizer。");
  console.log("高 96 位回答：这份授权从什么时候开始、到什么时候结束。EntryPoint 会按当前时间强制。");
}

runIfMain(import.meta.url, runDemo);
