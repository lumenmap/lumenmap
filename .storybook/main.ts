export interface StorybookConfig {
  stories: string[];
  addons: string[];
  framework: {
    name: string;
    options: Record<string, unknown>;
  };
  staticDirs: string[];
}

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
};

export default config;
