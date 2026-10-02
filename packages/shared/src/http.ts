/** Header dùng chung giữa API và frontend [TDD 7.1, 9.2, 9.3] */
export const HEADER_CLIENT = 'X-VSN-Client';
export const HEADER_TRACE_ID = 'X-Trace-Id';
/** Request polling không gia hạn phiên Web [D24] */
export const HEADER_POLLING = 'X-VSN-Polling';

export type LoaiClient = 'worker' | 'web';

export const COOKIE_THIET_BI = 'vsn_tb';
export const COOKIE_PHIEN = 'vsn_sid';
