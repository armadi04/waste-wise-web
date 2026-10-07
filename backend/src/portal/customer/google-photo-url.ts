import { BadRequestException } from '@nestjs/common';

export function googlePhotoUrl(picture: string): URL {
  let url: URL;
  try {
    url = new URL(picture);
  } catch {
    throw new BadRequestException('Invalid Google photo URL');
  }
  if (
    url.href.length > 2048 ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !(
      url.hostname === 'googleusercontent.com' ||
      url.hostname.endsWith('.googleusercontent.com')
    )
  )
    throw new BadRequestException('Invalid Google photo URL');
  return url;
}
