import { useMemo } from 'react';
import { removeNullishValues } from 'librechat-data-provider';
import type { Artifact } from '~/common';
import { getKey, getProps, getTemplate, getArtifactFilename } from '~/utils/artifacts';
import { getMermaidFiles } from '~/utils/mermaid';
import { getMarkdownFiles } from '~/utils/markdown';

/**
 * Patch relative /brand/ and /libs/ asset paths in an HTML artifact to
 * absolute app-origin URLs so they load correctly inside Sandpack's sandboxed
 * iframe (whose origin differs from the main app).  Also injects
 * window._BRAND_ORIGIN so the presentation script's _getOrigin() returns the
 * correct origin even when window.parent.location is cross-origin.
 */
function patchHtmlForSandpack(html: string): string {
  const origin = window.location.origin;
  // Inject origin constant before </head> so JS on the page can use it
  let patched = html.replace(
    /<\/head>/i,
    `<script>window._BRAND_ORIGIN=${JSON.stringify(origin)};</script></head>`,
  );
  // Fix relative paths in HTML src attributes and CSS url() calls
  patched = patched
    .replace(/(src=['"])\/brand\//g, `$1${origin}/brand/`)
    .replace(/(src=['"])\/libs\//g, `$1${origin}/libs/`)
    .replace(/(url\(['"]?)\/brand\//g, `$1${origin}/brand/`)
    .replace(/(url\(['"]?)\/libs\//g, `$1${origin}/libs/`);
  return patched;
}

export default function useArtifactProps({ artifact }: { artifact: Artifact }) {
  const [fileKey, files] = useMemo(() => {
    const key = getKey(artifact.type ?? '', artifact.language);
    const type = artifact.type ?? '';

    if (key.includes('mermaid')) {
      return ['diagram.mmd', getMermaidFiles(artifact.content ?? '')];
    }

    if (type === 'text/markdown' || type === 'text/md' || type === 'text/plain') {
      return ['content.md', getMarkdownFiles(artifact.content ?? '')];
    }

    const fileKey = getArtifactFilename(artifact.type ?? '', artifact.language);
    let content = artifact.content ?? '';
    if (type === 'text/html' || type === 'application/vnd.code-html') {
      content = patchHtmlForSandpack(content);
    }
    const files = removeNullishValues({
      [fileKey]: content,
    });
    return [fileKey, files];
  }, [artifact.type, artifact.content, artifact.language]);

  const template = useMemo(
    () => getTemplate(artifact.type ?? '', artifact.language),
    [artifact.type, artifact.language],
  );

  const sharedProps = useMemo(() => getProps(artifact.type ?? ''), [artifact.type]);

  return {
    files,
    fileKey,
    template,
    sharedProps,
  };
}
