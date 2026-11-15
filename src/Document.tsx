import { HydrationScript, type JSX } from "@solidjs/web";

export default function Document(props: {
  children?: JSX.Element;
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>EffectTS Progressive Workshop — Pipeline-Only Teaching Session</title>
        <meta
          name="description"
          content="A progressive, pipeline-only EffectTS teaching session covering Effect, Layer, Option, Config, Schema, Match, Stream, HttpApi, PersistedQueue, and Cluster actors."
        />
        <meta property="og:title" content="EffectTS Progressive Workshop" />
        <meta
          property="og:description"
          content="Progressive, pipeline-only EffectTS workshop from minimalist Effect + Layer to HttpApi, PersistedQueue, and Cluster actors."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <HydrationScript />
      </head>
      <body class="bg-slate-50 text-slate-900 antialiased selection:bg-sky-100 selection:text-sky-900">
        {props.children}
      </body>
    </html>
  );
}
