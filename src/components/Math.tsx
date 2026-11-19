import { useMemo } from "react";
import katex from "katex";

interface Props {
  tex: string;
  block?: boolean;
  className?: string;
}

export default function Math({ tex, block = false, className = "" }: Props) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false }),
    [tex, block],
  );
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
