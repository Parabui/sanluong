/**
 * N1 — một nguồn sự thật: enum trong schema.prisma phải khớp danh sách trong @vsn/shared.
 * Thêm ChucNang/VaiTro ở một bên mà quên bên kia → test đỏ.
 */
import { CHUC_NANG, VAI_TRO } from '@vsn/shared';
import { describe, expect, it } from 'vitest';
import { ChucNang, VaiTro } from '../generated/prisma/enums.js';

describe('Enum Prisma ↔ @vsn/shared', () => {
  it('ChucNang khớp CHUC_NANG', () => {
    expect(Object.values(ChucNang)).toEqual([...CHUC_NANG]);
  });

  it('VaiTro khớp VAI_TRO', () => {
    expect(Object.values(VaiTro)).toEqual([...VAI_TRO]);
  });
});
