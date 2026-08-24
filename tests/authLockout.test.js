jest.mock('../models/User', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/VerificationOtp', () => ({}));

const User = require('../models/User');
const authController = require('../controllers/authController');

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((payload) => {
      res.body = payload;
      return res;
    })
  };

  return res;
};

const createUser = (overrides = {}) => ({
  _id: { toString: () => 'user-1' },
  email: 'user@example.com',
  failedLoginAttempts: 0,
  loginLockUntil: null,
  tokens: [],
  comparePassword: jest.fn(),
  save: jest.fn(),
  toObject: jest.fn(() => ({
    _id: 'user-1',
    email: 'user@example.com',
    username: 'Test User',
    password: 'hashed-password',
    tokens: []
  })),
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('login increments failed attempts and returns remaining attempts', async () => {
  const user = createUser({ failedLoginAttempts: 1 });
  user.comparePassword.mockResolvedValue(false);
  User.findOne.mockResolvedValue(user);

  const req = { body: { email: ' USER@example.com ', password: 'wrong-password' } };
  const res = createResponse();

  await authController.login(req, res);

  expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
  expect(user.failedLoginAttempts).toBe(2);
  expect(user.loginLockUntil).toBeNull();
  expect(user.save).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.body.error).toBe('Invalid credentials. 1 login attempt remaining before lock.');
});

test('login locks account on third failed password attempt', async () => {
  const user = createUser({ failedLoginAttempts: 2 });
  user.comparePassword.mockResolvedValue(false);
  User.findOne.mockResolvedValue(user);

  const req = { body: { email: 'user@example.com', password: 'wrong-password' } };
  const res = createResponse();

  await authController.login(req, res);

  expect(user.failedLoginAttempts).toBe(3);
  expect(user.loginLockUntil).toBeInstanceOf(Date);
  expect(user.loginLockUntil.getTime()).toBeGreaterThan(Date.now());
  expect(user.save).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(423);
  expect(res.body.error).toMatch(/^Account locked due to too many failed login attempts\./);
});

test('login blocks attempts while account is locked', async () => {
  const user = createUser({
    failedLoginAttempts: 3,
    loginLockUntil: new Date(Date.now() + 10 * 60 * 1000)
  });
  User.findOne.mockResolvedValue(user);

  const req = { body: { email: 'user@example.com', password: 'correct-password' } };
  const res = createResponse();

  await authController.login(req, res);

  expect(user.comparePassword).not.toHaveBeenCalled();
  expect(user.save).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(423);
  expect(res.body.error).toMatch(/^Account locked due to too many failed login attempts\./);
});

test('login resets failed attempts after successful login', async () => {
  const user = createUser({
    failedLoginAttempts: 2,
    loginLockUntil: new Date(Date.now() - 60 * 1000)
  });
  user.comparePassword.mockResolvedValue(true);
  User.findOne.mockResolvedValue(user);

  const req = { body: { email: 'user@example.com', password: 'correct-password' } };
  const res = createResponse();

  await authController.login(req, res);

  expect(user.failedLoginAttempts).toBe(0);
  expect(user.loginLockUntil).toBeNull();
  expect(user.tokens).toHaveLength(1);
  expect(user.save).toHaveBeenCalledTimes(2);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.body.token).toBeTruthy();
});
