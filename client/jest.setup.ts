import "@testing-library/jest-dom";

// Mock next/image since it's not available in test environment
jest.mock("next/image", () => ({
  __esModule: true,
  default: function Image({
    src,
    alt,
    width,
    height,
    style,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    style?: Record<string, unknown>;
  }) {
    // Return a standard img element
    const img = document.createElement("img");
    img.src = src as string;
    img.alt = alt;
    if (width) img.width = width;
    if (height) img.height = height;
    if (style) {
      Object.assign(img.style, style);
    }
    return img;
  },
}));
