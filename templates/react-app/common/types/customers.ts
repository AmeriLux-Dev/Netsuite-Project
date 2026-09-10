export interface CustomerSummary {
    id: number;
    companyName: string;
    email: string | null;
}

/** Restlet GET parameters arrive as strings; the domain function parses them. */
export interface CustomerListRequest {
    /** Case-insensitive substring of the company name. */
    search?: string;
    /** Maximum rows; the domain clamps it. */
    limit?: number | string;
}

export interface CustomerListResponse {
    customers: CustomerSummary[];
    limit: number;
}
