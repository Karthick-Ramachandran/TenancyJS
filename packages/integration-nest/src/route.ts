import { SetMetadata } from "@nestjs/common";

export const TENANT_ROUTE_METADATA = "tenancyjs:tenant-route";

export const TenantRoute = (): ClassDecorator & MethodDecorator =>
  SetMetadata(TENANT_ROUTE_METADATA, true);
