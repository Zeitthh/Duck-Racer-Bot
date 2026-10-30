import { DUCK_NAME_MAX, type DuckNameResult } from '@duckbot/core';
import type { Ctx } from '../context';

type NameError = Extract<DuckNameResult, { ok: false }>['error'];

export function nameErrorMessage(error: NameError, ctx: Ctx): string {
  switch (error) {
    case 'empty':
      return ctx.t('name.empty');
    case 'tooLong':
      return ctx.t('name.tooLong', { max: DUCK_NAME_MAX });
    case 'invalid':
      return ctx.t('name.invalid');
  }
}
