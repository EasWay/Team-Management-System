import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Landing from "./Landing";

// Mock dependencies
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", mockSetLocation],
}));

const mockMutateAsync = vi.fn();
const mockIsPending = vi.fn(() => false);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      login: {
        useMutation: () => ({
          mutateAsync: mockMutateAsync,
          isPending: mockIsPending(),
        }),
      },
    },
  },
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({
    useTheme: () => ({ theme: 'dark' }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Helper function to render component with providers
const renderLanding = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Landing />
    </QueryClientProvider>
  );
};

describe("Landing Page Component", () => {
  let mockSetAccessToken: ReturnType<typeof vi.fn>;
  let mockSetRefreshToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSetLocation.mockClear();
    mockMutateAsync.mockClear();
    mockIsPending.mockReturnValue(false);

    const { tokenStorage } = await import("@/lib/tokenStorage");
    mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);
    mockSetRefreshToken = vi.mocked(tokenStorage.setRefreshToken);

    mockSetAccessToken.mockClear();
    mockSetRefreshToken.mockClear();
  });

  it("should render form with email and password fields", () => {
    renderLanding();

    const emailField = screen.getByLabelText(/email/i);
    expect(emailField).toBeDefined();

    const passwordField = screen.getByLabelText(/password/i);
    expect(passwordField).toBeDefined();

    const submitButton = screen.getByRole('button', { name: /initialize session/i });
    expect(submitButton).toBeDefined();
  });

  it("should redirect to dashboard on successful login", async () => {
    const user = userEvent.setup();

    const mockResponse = {
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
    };

    mockMutateAsync.mockResolvedValueOnce(mockResponse);

    renderLanding();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /initialize session/i });

    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/");
    });
  });

  it("should display error message on login failure", async () => {
    const user = userEvent.setup();

    const mockError = new Error(JSON.stringify({ error: "Invalid credentials" }));
    mockMutateAsync.mockRejectedValueOnce(mockError);

    renderLanding();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /initialize session/i });

    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/invalid credentials/i);
      expect(errorMessage).toBeDefined();
    });
  });
});
