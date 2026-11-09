export const previewParameters = {
  layout: "padded" as const,
  fixtureOnly: true,
  backgrounds: {
    default: "dark",
    values: [
      { name: "dark", value: "#09090b" },
      { name: "surface", value: "#18181b" },
    ],
  },
};

export default {
  parameters: previewParameters,
};
