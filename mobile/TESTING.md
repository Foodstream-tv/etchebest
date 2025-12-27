# Unit Testing Setup for Etchebest

## Testing Stack

- **Jest**: Testing framework
- **@testing-library/react-native**: React Native testing utilities
- **jest-expo**: Jest preset for Expo projects

## Running Tests

```bash
# Run all tests once
npm test
# or
make test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
# or
make test-watch

# Run tests with coverage report
npm run test:coverage
# or
make test-coverage
```

## Test Files Location

Tests are located in `app/__tests__/` directory:

- `login.test.tsx` - Tests for login screen
- `register.test.tsx` - Tests for register screen

## Example Test Structure

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import YourComponent from '../YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    const { getByText } = render(<YourComponent />);
    expect(getByText('Some Text')).toBeTruthy();
  });

  it('handles user interaction', async () => {
    const { getByText } = render(<YourComponent />);
    const button = getByText('Click Me');
    
    fireEvent.press(button);
    
    await waitFor(() => {
      expect(getByText('Clicked!')).toBeTruthy();
    });
  });
});
```

## What's Tested

### Login Screen (`login.test.tsx`)

- ✅ Renders all elements correctly
- ✅ Floating labels appear on focus/value
- ✅ Email validation
- ✅ Password validation (min 8 characters)
- ✅ Password visibility toggle
- ✅ Navigation to forgot password
- ✅ Navigation to register
- ✅ Social login interactions
- ✅ Successful login flow

### Register Screen (`register.test.tsx`)

- ✅ Renders all elements correctly
- ✅ Floating labels on inputs
- ✅ Email validation
- ✅ Username validation (min 3 characters)
- ✅ Password validation (min 8 characters)
- ✅ Birthdate validation
- ✅ Date input handling
- ✅ Successful registration flow

## Adding New Tests

1. Create a test file in `app/__tests__/` or `components/__tests__/`
2. Name it with `.test.tsx` or `.test.ts` extension
3. Import testing utilities and your component
4. Write test cases using `describe` and `it` blocks
5. Run tests to verify

## Mocked Dependencies

The following are automatically mocked in `jest.setup.js`:

- `expo-router` - Navigation hooks
- `@expo/vector-icons` - Icon components
- `toastify-react-native` - Toast notifications
- React Native animations

## Coverage Report

After running `make test-coverage`, view the report in:

- Terminal output (summary)
- `coverage/lcov-report/index.html` (detailed HTML report)
