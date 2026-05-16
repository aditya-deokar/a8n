/**
 * Pagination Helpers
 *
 * Shared utilities for building paginated MCP tool responses.
 * Reuses the same pagination constants from the app config.
 */

import { PAGINATION } from "@/config/constants";

/** Standard pagination input for list tools */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

/** Standard pagination output included in list responses */
export interface PaginationOutput {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Normalize pagination input with safe defaults and bounds.
 */
export function normalizePagination(input: PaginationInput) {
  const page = Math.max(input.page ?? PAGINATION.DEFAULT_PAGE, 1);
  const pageSize = Math.min(
    Math.max(input.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE),
    PAGINATION.MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Build the pagination metadata for a response.
 */
export function buildPaginationOutput(
  page: number,
  pageSize: number,
  totalCount: number,
): PaginationOutput {
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
