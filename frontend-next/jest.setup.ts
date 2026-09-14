import "@testing-library/jest-dom";
import "@/shared/tests/next-auth-mock";
import React from "react";

// Mocks
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.confirm = jest.fn();

jest.mock("react-code-blocks", () => ({
  CopyBlock: ({ text }: { text: string }) => null,
  a11yLight: {},
}));

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: jest.fn().mockReturnValue({
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    isReady: () => true,
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/alerts/feed",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock useConfig hook
jest.mock("@/utils/hooks/useConfig", () => ({
  useConfig: jest.fn().mockReturnValue({
    data: {},
  }),
}));

// Mock usePresets
jest.mock("@/entities/presets/model/usePresets", () => ({
  usePresets: jest.fn(() => ({
    dynamicPresets: [],
    staticPresets: [],
    isLoading: false,
  })),
}));

// Mock useAlerts
jest.mock("@/entities/alerts/model", () => ({
  useAlerts: jest.fn(() => ({
    useErrorAlerts: jest.fn(() => ({ data: [] })),
  })),
}));

// Mock react-icons
jest.mock("react-icons/gr", () => ({
  GrTest: () => null,
}));

jest.mock("react-icons/md", () => ({
  MdErrorOutline: () => null,
}));

jest.mock("react-icons/tb", () => ({
  TbSparkles: () => null,
}));

