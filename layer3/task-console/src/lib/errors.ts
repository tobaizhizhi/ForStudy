import { BaseError, UserRejectedRequestError } from "viem";

export function getReadableError(error: unknown) {
  if (error instanceof UserRejectedRequestError) {
    return "你取消了这次操作，链上没有变化。";
  }

  if (error instanceof BaseError) {
    return error.shortMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请检查钱包、网络和合约配置。";
}
