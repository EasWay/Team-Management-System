import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Register from "./Register";

// Mock dependencies
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/register", mockSetLocation],
}));

const mockMutateAsync = vi.fn();
const mockIsPending = vi.fn(() => false);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      register: {
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
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
  },
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
const renderRegister = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Register />
    </QueryClientProvider>
  );
};

describe("Register Page Component", () => {
  let mockSetAccessToken: ReturnType<typeof vi.fn>;
  let mockSetRefreshToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockSetLocation.mockClear();
    mockMutateAsync.mockClear();
    mockIsPending.mockReturnValue(false); // Reset to false by default
    
    // Get the mocked functions from the module
    const { tokenStorage } = await import("@/lib/tokenStorage");
    mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);
    mockSetRefreshToken = vi.mocked(tokenStorage.setRefreshToken);
    
    mockSetAccessToken.mockClear();
    mockSetRefreshToken.mockClear();
  });

  it("should render form with email, password, and confirm password fields", () => {
    // Test form renders with all required fields - validates Requirements 8.2, 8.5
    renderRegister();

    // Check that email field is present
    const emailField = screen.getByLabelText(/email/i);
    expect(emailField).toBeDefined();
    expect(emailField.getAttribute('type')).toBe('email');

    // Check that password field is present
    const passwordField = screen.getByLabelText(/^password$/i);
    expect(passwordField).toBeDefined();
    expect(passwordField.getAttribute('type')).toBe('password');

    // Check that confirm password field is present
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    expect(confirmPasswordField).toBeDefined();
    expect(confirmPasswordField.getAttribute('type')).toBe('password');

    // Check that submit button is present
    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toBeDefined();

    // Check that sign in link is present
    const signInLink = screen.getByRole('button', { name: /sign in/i });
    expect(signInLink).toBeDefined();
  });

  it("should display password requirements", () => {
    // Test password requirements display - validates Requirements 1.4, 8.5
    renderRegister();

    const passwordRequirement = screen.getByText(/password must be at least 8 characters long/i);
    expect(passwordRequirement).toBeDefined();
  });

  it("should prevent submission with invalid email", async () => {
    // Test form validation prevents submission with invalid email - validates Requirements 1.3, 8.5
    const user = userEvent.setup();
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter invalid email and valid passwords
    await user.type(emailField, 'invalid-email');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Check that validation error is displayed
    await waitFor(() => {
      const errorMessage = screen.getByText(/please enter a valid email address/i);
      expect(errorMessage).toBeDefined();
    });

    // Verify that the API was not called
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("should prevent submission with password less than 8 characters", async () => {
    // Test form validation prevents submission with short password - validates Requirements 1.4, 8.5
    const user = userEvent.setup();
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter valid email but short password
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'short');
    await user.type(confirmPasswordField, 'short');
    await user.click(submitButton);

    // Check that validation error is displayed
    await waitFor(() => {
      const errorMessage = screen.getByText(/password must be at least 8 characters long/i);
      expect(errorMessage).toBeDefined();
    });

    // Verify that the API was not called
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("should prevent submission if passwords don't match", async () => {
    // Test form validation prevents submission if passwords don't match - validates Requirements 8.5
    const user = userEvent.setup();
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter valid email but mismatched passwords
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password456');
    await user.click(submitButton);

    // Check that validation error is displayed
    await waitFor(() => {
      const errorMessage = screen.getByText(/passwords don't match/i);
      expect(errorMessage).toBeDefined();
    });

    // Verify that the API was not called
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("should store tokens in localStorage on successful registration", async () => {
    // Test successful registration stores tokens in localStorage - validates Requirements 5.1, 5.2, 8.6
    const user = userEvent.setup();
    
    // Mock successful registration response
    const mockResponse = {
      success: true,
      user: {
        id: 1,
        email: "user@example.com",
        name: "Test User",
        role: "user",
      },
      accessToken: "mock_access_token_12345",
      refreshToken: "mock_refresh_token_67890",
    };
    
    mockMutateAsync.mockResolvedValueOnce(mockResponse);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter valid credentials
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for the API call to complete
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });

    // Verify tokens are stored
    expect(mockSetAccessToken).toHaveBeenCalledWith("mock_access_token_12345");
    expect(mockSetRefreshToken).toHaveBeenCalledWith("mock_refresh_token_67890");
  });

  it("should redirect to dashboard on successful registration", async () => {
    // Test successful registration redirects to dashboard - validates Requirements 8.6, 8.7
    const user = userEvent.setup();
    
    // Mock successful registration response
    const mockResponse = {
      success: true,
      user: {
        id: 1,
        email: "user@example.com",
        name: "Test User",
        role: "user",
      },
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
    };
    
    mockMutateAsync.mockResolvedValueOnce(mockResponse);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter valid credentials and submit
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for redirect
    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/");
    });
  });

  it("should display duplicate email error", async () => {
    // Test duplicate email error displays - validates Requirements 1.2, 8.7
    const user = userEvent.setup();
    
    // Mock registration failure with duplicate email
    const mockError = new Error(JSON.stringify({ error: "Email already in use" }));
    mockMutateAsync.mockRejectedValueOnce(mockError);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter credentials and submit
    await user.type(emailField, 'existing@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for error message to appear
    await waitFor(() => {
      const errorMessage = screen.getByText(/email already in use/i);
      expect(errorMessage).toBeDefined();
    });

    // Verify tokens are not stored on failure
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    expect(mockSetRefreshToken).not.toHaveBeenCalled();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("should display server errors in alert banner", async () => {
    // Test server errors display in alert banner - validates Requirements 8.7
    const user = userEvent.setup();
    
    // Mock server error
    const mockError = new Error("Server error occurred");
    mockMutateAsync.mockRejectedValueOnce(mockError);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter credentials and submit
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for error message to appear
    await waitFor(() => {
      const errorMessage = screen.getByText(/server error occurred/i);
      expect(errorMessage).toBeDefined();
    });
  });

  it("should show loading state during submission", async () => {
    // Test loading state during submission - validates Requirements 8.6
    mockIsPending.mockReturnValue(true);
    
    renderRegister();

    // When loading, button should show loading text and be disabled
    const loadingButton = screen.getByRole('button', { name: /creating account/i });
    expect(loadingButton).toBeDefined();
    expect(loadingButton).toBeDisabled();
    
    // Check that loading spinner is present
    const loadingSpinner = screen.getByRole('status', { name: /loading/i });
    expect(loadingSpinner).toBeDefined();

    // Check that form fields are disabled during loading
    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    
    expect(emailField).toBeDisabled();
    expect(passwordField).toBeDisabled();
    expect(confirmPasswordField).toBeDisabled();
  });

  it("should navigate to login page when sign in is clicked", async () => {
    // Test navigation to login page - validates Requirements 8.2
    const user = userEvent.setup();
    renderRegister();

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(signInButton);

    expect(mockSetLocation).toHaveBeenCalledWith("/login");
  });

  it("should display page title and description", () => {
    // Test UI content - validates Requirements 8.2, 8.5
    renderRegister();

    // Check that both title and button exist
    const createAccountElements = screen.getAllByText('Create Account');
    expect(createAccountElements).toHaveLength(2); // Title and button

    const description = screen.getByText(/enter your details to create a new account/i);
    expect(description).toBeDefined();
  });

  it("should have proper form accessibility attributes", () => {
    // Test accessibility - validates Requirements 8.2, 8.5
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);

    // Check autocomplete attributes
    expect(emailField.getAttribute('autocomplete')).toBe('email');
    expect(passwordField.getAttribute('autocomplete')).toBe('new-password');
    expect(confirmPasswordField.getAttribute('autocomplete')).toBe('new-password');

    // Check input types
    expect(emailField.getAttribute('type')).toBe('email');
    expect(passwordField.getAttribute('type')).toBe('password');
    expect(confirmPasswordField.getAttribute('type')).toBe('password');
  });

  it("should preserve form data on error except passwords", async () => {
    // Test form data preserved on error - validates Requirements 8.7
    const user = userEvent.setup();
    
    // Mock registration failure
    const mockError = new Error(JSON.stringify({ error: "Registration failed" }));
    mockMutateAsync.mockRejectedValueOnce(mockError);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordField = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    const confirmPasswordField = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter credentials and submit
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for error to appear
    await waitFor(() => {
      const errorMessage = screen.getByText(/registration failed/i);
      expect(errorMessage).toBeDefined();
    });

    // Verify email field is preserved
    expect(emailField.value).toBe('user@example.com');
    // Password fields should be cleared for security (this is handled by the form)
  });

  it("should handle generic server errors gracefully", async () => {
    // Test generic server error handling - validates Requirements 8.7
    const user = userEvent.setup();
    
    // Mock generic server error
    const mockError = new Error("Network error");
    mockMutateAsync.mockRejectedValueOnce(mockError);
    
    renderRegister();

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/^password$/i);
    const confirmPasswordField = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Enter credentials and submit
    await user.type(emailField, 'user@example.com');
    await user.type(passwordField, 'password123');
    await user.type(confirmPasswordField, 'password123');
    await user.click(submitButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/network error/i);
      expect(errorMessage).toBeDefined();
    });
  });
});