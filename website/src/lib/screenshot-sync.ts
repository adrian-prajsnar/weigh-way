import type { SiteLocale } from '../i18n';
import type { ScreenshotId, ScreenshotTheme } from './screenshots';

export function screenshotSrc(
  baseUrl: string,
  id: ScreenshotId | string,
  theme: ScreenshotTheme,
  locale: SiteLocale | string,
): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/screenshots/${id}-${theme}-${locale}.webp`;
}

/** Runs in <head> after theme bootstrap so screenshot src matches data-theme before paint. */
export function buildScreenshotBootstrapScript(baseUrl: string): string {
  const escapedBase = JSON.stringify(baseUrl);
  return `(function(){var baseUrl=${escapedBase};function theme(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';}function src(id){var locale=document.documentElement.getAttribute('data-screenshot-locale')||'en';var base=String(baseUrl).replace(/\\/$/,'');return base+'/screenshots/'+id+'-'+theme()+'-'+locale+'.webp';}function apply(img){if(!img||img.tagName!=='IMG')return;var id=img.getAttribute('data-screenshot');if(!id)return;var next=src(id);if(img.getAttribute('src')!==next){img.setAttribute('src',next);}}function syncScreenshotImages(){document.querySelectorAll('[data-screenshot]').forEach(apply);}window.syncScreenshotImages=syncScreenshotImages;new MutationObserver(function(mutations){mutations.forEach(function(m){m.addedNodes.forEach(function(node){if(node.nodeType!==1)return;var el=node;if(el.matches&&el.matches('[data-screenshot]'))apply(el);if(el.querySelectorAll)el.querySelectorAll('[data-screenshot]').forEach(apply);});});}).observe(document.documentElement,{childList:true,subtree:true});})();`;
}
