/**
 * Test Data Generators
 * 
 * Typed generators for creating test data in Playwright tests.
 * Supports route interception and local-only usage.
 */

// ============ Types ============

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  inStock?: boolean;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
  publishedAt?: string;
  tags?: string[];
}

export type Generatable = User | Product | Article;

// ============ ID Generator ============

let idCounter = 0;

function generateId(prefix: string = 'id'): string {
  idCounter++;
  return `${prefix}_${idCounter}_${Date.now()}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============ User Generators ============

export function generateUser(overrides?: Partial<User>): User {
  const base: User = {
    id: generateId('user'),
    email: `test_${Date.now()}@example.com`,
    username: `testuser_${idCounter}`,
    createdAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

export function generateUsers(count: number, overrides?: Partial<User>): User[] {
  return Array.from({ length: count }, () => generateUser(overrides));
}

// ============ Product Generators ============

export function generateProduct(overrides?: Partial<Product>): Product {
  const base: Product = {
    id: generateId('prod'),
    name: `Test Product ${idCounter}`,
    price: Math.round(Math.random() * 10000) / 100,
    inStock: true,
  };
  return { ...base, ...overrides };
}

export function generateProducts(count: number, overrides?: Partial<Product>): Product[] {
  return Array.from({ length: count }, () => generateProduct(overrides));
}

// ============ Article Generators ============

export function generateArticle(overrides?: Partial<Article>): Article {
  const base: Article = {
    id: generateId('art'),
    title: `Test Article ${idCounter}`,
    content: `This is the content of test article #${idCounter}.`,
    publishedAt: new Date().toISOString(),
    tags: ['test', 'sample'],
  };
  return { ...base, ...overrides };
}

export function generateArticles(count: number, overrides?: Partial<Article>): Article[] {
  return Array.from({ length: count }, () => generateArticle(overrides));
}

// ============ Generic Item Generator ============

export function generateItem<T extends Generatable>(
  type: 'user' | 'product' | 'article',
  overrides?: Partial<T>
): T {
  switch (type) {
    case 'user':
      return generateUser(overrides as Partial<User>) as T;
    case 'product':
      return generateProduct(overrides as Partial<Product>) as T;
    case 'article':
      return generateArticle(overrides as Partial<Article>) as T;
    default:
      throw new Error(`Unknown item type: ${type}`);
  }
}

// ============ Seed & Reset Helpers ============

export interface SeedData {
  users: User[];
  products: Product[];
  articles: Article[];
}

export function seedTestData(seed?: Partial<SeedData>): SeedData {
  const data: SeedData = {
    users: seed?.users || generateUsers(3),
    products: seed?.products || generateProducts(5),
    articles: seed?.articles || generateArticles(2),
  };
  return data;
}

export function resetTestData(): void {
  resetIdCounter();
}

// ============ Usage Notes ============
// USAGE WITH PLAYWRIGHT ROUTE INTERCEPTION:
//
// In your test file:
// import { generateUser, generateProducts, seedTestData, resetTestData } from '../fixtures/test-data';
//
// test('example', async ({ page }) => {
//   const testData = seedTestData();
//   await page.route('**/api/users', (route) => {
//     route.fulfill({ json: testData.users });
//   });
//   resetTestData();
// });
//
// CUSTOMIZATION:
// Override specific fields:
// const adminUser = generateUser({ email: 'admin@example.com' });
// Generate multiple items:
// const products = generateProducts(10, { inStock: true });
