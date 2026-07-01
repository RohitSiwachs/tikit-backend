import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('deep-link')
@Controller()
export class DeepLinkController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('join/:schoolCode')
  @Public()
  @ApiOperation({ summary: 'Deep link redirect — opens app or shows landing page' })
  async joinSchool(
    @Param('schoolCode') schoolCode: string,
    @Res() res: Response,
  ) {
    const school = await this.prisma.school.findUnique({
      where: { schoolCode },
    });

    if (!school) {
      throw new NotFoundException('Invalid school code');
    }

    // Try to open the app via custom URI scheme.
    // If app is installed, this will open it with the schoolCode pre-filled.
    // The app developer will configure `tikit://` scheme in Expo.
    const appDeepLink = `tikit://join?schoolCode=${schoolCode}`;

    // Universal Links / App Links for when the app is published:
    // iOS: https://tikit.se/join/{schoolCode}  (configured via apple-app-site-association)
    // Android: https://tikit.se/join/{schoolCode}  (configured via assetlinks.json)

    // For now, serve a simple HTML page that:
    // 1. Attempts to open the app via custom scheme
    // 2. Falls back to a "Download the app" landing page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${school.name} on TiKit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .school-name { font-size: 18px; opacity: 0.9; margin-bottom: 24px; }
    .code-box {
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .code-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
    .code-value { font-size: 28px; font-weight: 700; letter-spacing: 4px; margin-top: 4px; }
    .btn {
      display: inline-block;
      background: #fff;
      color: #764ba2;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .info { margin-top: 20px; font-size: 13px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🎟️</div>
    <h1>Join TiKit</h1>
    <p class="school-name">${school.name}</p>
    <div class="code-box">
      <div class="code-label">Your School Code</div>
      <div class="code-value">${schoolCode}</div>
    </div>
    <a href="${appDeepLink}" class="btn" id="openApp">Open in TiKit App</a>
    <p class="info">Don't have the app yet? Download it from the App Store or Google Play.</p>
  </div>

  <script>
    // Attempt to open the app, if it fails the user stays on this page
    setTimeout(function() {
      window.location.href = '${appDeepLink}';
    }, 100);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
