import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta = {
  title: "Foundation/Status",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  render: () => (
    <main>
      <strong>Yas English Lab</strong>
      <p>Storybook foundation is configured.</p>
    </main>
  ),
};
