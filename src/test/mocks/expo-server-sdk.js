const MockExpo = jest.fn().mockImplementation(() => ({
  chunkPushNotifications: jest.fn().mockReturnValue([]),
  sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
}));
MockExpo.isExpoPushToken = jest.fn().mockReturnValue(true);

module.exports = {
  __esModule: true,
  default: MockExpo,
  Expo: MockExpo,
};
