import { Module } from '@nestjs/common';
import { RemoteThemeController } from './remote-theme.controller';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

/*
 * Two controllers, one service. `ThemeController` keeps the unversioned,
 * public `/api/themes` routes for the operator's configured host;
 * `RemoteThemeController` adds the authenticated `/api/v1/themes/remote`
 * routes for application-supplied hosts. They share a `ThemeService`
 * instance so the origin allowlist, timeout, and cache are configured once.
 */
@Module({
  controllers: [ThemeController, RemoteThemeController],
  providers: [ThemeService],
})
export class ThemesModule {}
