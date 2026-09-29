import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    a11y: {
      test: "error",
    },
    backgrounds: {
      default: "yas-canvas",
      values: [
        { name: "yas-canvas", value: "#f6f3fc" },
        { name: "white", value: "#ffffff" },
        { name: "purple", value: "#32125f" },
      ],
    },
  },
};

export default preview;
