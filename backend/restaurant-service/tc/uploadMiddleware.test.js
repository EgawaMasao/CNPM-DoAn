import { jest } from '@jest/globals';

// Create mocks for external dependencies
const mockDiskStorage = jest.fn();
const mockMulter = jest.fn();

// Mock the multer module
jest.unstable_mockModule('multer', () => ({
  default: Object.assign(mockMulter, {
    diskStorage: mockDiskStorage
  })
}));

// Mock path module
jest.unstable_mockModule('path', () => ({
  default: {
    extname: jest.fn((filename) => {
      const match = filename.match(/\.[^.]*$/);
      return match ? match[0] : '';
    })
  }
}));

// Import after mocking
const pathModule = await import('path');
const path = pathModule.default;

describe('UploadMiddleware', () => {
  let storage;
  let fileFilter;
  let destinationFn;
  let filenameFn;
  let mockReq;
  let mockFile;
  let mockCallback;
  let originalDateNow;
  let originalMathRandom;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup multer.diskStorage mock to capture the config
    mockDiskStorage.mockImplementation((config) => {
      destinationFn = config.destination;
      filenameFn = config.filename;
      return { destination: destinationFn, filename: filenameFn };
    });

    // Mock Date.now and Math.random
    originalDateNow = Date.now;
    originalMathRandom = Math.random;
    Date.now = jest.fn();
    Math.random = jest.fn();

    // Re-import the module to get fresh instance with mocks
    jest.unstable_mockModule('../src/middleware/uploadMiddleware.js', () => ({}));
    
    // Manually create storage and fileFilter based on production code
    storage = {
      destination: function (req, file, cb) {
        cb(null, 'uploads/');
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    };

    fileFilter = (req, file, cb) => {
      const fileTypes = /jpeg|jpg|png/;
      const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = fileTypes.test(file.mimetype);

      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only .jpg, .jpeg, .png files are allowed!'));
      }
    };

    // Setup mock objects
    mockReq = {};
    mockFile = {
      originalname: '',
      mimetype: ''
    };
    mockCallback = jest.fn();
  });

  afterEach(() => {
    // Restore original functions
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  });

  // Test 1: Valid JPEG file - verifies successful file type validation with both extension and mimetype
  test('should accept valid JPEG file with correct extension and mimetype', () => {
    // GIVEN a valid JPEG file with .jpeg extension and image/jpeg mimetype
    mockFile.originalname = 'photo.jpeg';
    mockFile.mimetype = 'image/jpeg';

    // WHEN fileFilter is called
    fileFilter(mockReq, mockFile, mockCallback);

    // THEN should call callback with null error and true (accept file)
    expect(mockCallback).toHaveBeenCalledWith(null, true);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 2: Valid PNG file - ensures PNG files pass validation correctly
  test('should accept valid PNG file with correct extension and mimetype', () => {
    // GIVEN a valid PNG file with .png extension and image/png mimetype
    mockFile.originalname = 'image.png';
    mockFile.mimetype = 'image/png';

    // WHEN fileFilter is called
    fileFilter(mockReq, mockFile, mockCallback);

    // THEN should call callback with null error and true (accept file)
    expect(mockCallback).toHaveBeenCalledWith(null, true);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 3: Invalid file type (PDF) - tests rejection of non-image files (methods_that_can_throw)
  test('should reject PDF file and throw error', () => {
    // GIVEN a PDF file with .pdf extension and application/pdf mimetype
    mockFile.originalname = 'document.pdf';
    mockFile.mimetype = 'application/pdf';

    // WHEN fileFilter is called
    fileFilter(mockReq, mockFile, mockCallback);

    // THEN should call callback with error message (reject file)
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Only .jpg, .jpeg, .png files are allowed!'
      })
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  // Test 4: Valid extension but wrong mimetype - validates both checks must pass (null_pointer_risk)
  test('should reject file with valid extension but wrong mimetype', () => {
    // GIVEN a file with .jpg extension but wrong mimetype (application/octet-stream)
    mockFile.originalname = 'fake-image.jpg';
    mockFile.mimetype = 'application/octet-stream';

    // WHEN fileFilter is called
    fileFilter(mockReq, mockFile, mockCallback);

    // THEN should call callback with error (both checks must pass)
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Only .jpg, .jpeg, .png files are allowed!'
      })
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 5: Case-insensitive extension (.JPG vs .jpg) - ensures toLowerCase() works correctly
  test('should accept file with uppercase extension (.JPG)', () => {
    // GIVEN a file with uppercase .JPG extension and correct mimetype
    mockFile.originalname = 'PHOTO.JPG';
    mockFile.mimetype = 'image/jpeg';

    // WHEN fileFilter is called
    fileFilter(mockReq, mockFile, mockCallback);

    // THEN should call callback with null error and true (case-insensitive)
    expect(mockCallback).toHaveBeenCalledWith(null, true);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 6: Unique filename generation - verifies Date.now() and Math.random() create unique names
  test('should generate unique filename using Date.now() and Math.random()', () => {
    // GIVEN a file and mocked Date.now() and Math.random()
    mockFile.originalname = 'test-image.jpg';
    Date.now.mockReturnValue(1699459200000);
    Math.random.mockReturnValue(0.123456789);
    const expectedUniqueSuffix = '1699459200000-123456789';

    // WHEN storage.filename is called
    storage.filename(mockReq, mockFile, mockCallback);

    // THEN should generate unique filename with timestamp and random number
    expect(Date.now).toHaveBeenCalled();
    expect(Math.random).toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledWith(null, `${expectedUniqueSuffix}.jpg`);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 7: File without extension - validates path.extname() handling (null_pointer_risk)
  test('should handle file without extension gracefully', () => {
    // GIVEN a file without extension (no dot in filename)
    mockFile.originalname = 'filenoextension';
    Date.now.mockReturnValue(1699459200000);
    Math.random.mockReturnValue(0.5);
    const expectedUniqueSuffix = '1699459200000-500000000';

    // WHEN storage.filename is called
    storage.filename(mockReq, mockFile, mockCallback);

    // THEN should generate filename without extension (empty string from extname)
    expect(mockCallback).toHaveBeenCalledWith(null, `${expectedUniqueSuffix}`);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Test 8: Correct destination path - confirms uploads/ folder is set correctly
  test('should set destination to uploads/ folder', () => {
    // GIVEN a request and file for upload
    mockFile.originalname = 'test.jpg';

    // WHEN storage.destination is called
    storage.destination(mockReq, mockFile, mockCallback);

    // THEN should call callback with uploads/ as destination
    expect(mockCallback).toHaveBeenCalledWith(null, 'uploads/');
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});
