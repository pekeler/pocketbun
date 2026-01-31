// Ported from pocketbase/apis/record_helpers.go
// Note: partial port; only rule-field checks needed by list endpoints are implemented.

import type { RequestInfo } from "../core/event_request.ts";
import { FilterQueryParam, SortQueryParam } from "../tools/search/types.ts";

const ruleQueryParams = [FilterQueryParam, SortQueryParam];
const superuserOnlyRuleFields = ["@collection.", "@request."];

export function checkForSuperuserOnlyRuleFields(requestInfo: RequestInfo): string | null {
  if (Object.keys(requestInfo.query).length === 0 || requestInfo.auth?.isSuperuser()) {
    return null;
  }

  for (const param of ruleQueryParams) {
    const value = requestInfo.query[param];
    if (!value) {
      continue;
    }

    for (const field of superuserOnlyRuleFields) {
      if (value.includes(field)) {
        return `Only superusers can filter by ${field}`;
      }
    }
  }

  return null;
}
