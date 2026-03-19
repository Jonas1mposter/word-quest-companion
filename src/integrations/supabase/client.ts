// Mock Supabase client using localStorage
// This replaces the real Supabase client for offline/local usage

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Helper to get/set localStorage data
const getStore = (table: string): any[] => {
  try {
    const data = localStorage.getItem(`wq_${table}`);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const setStore = (table: string, data: any[]) => {
  localStorage.setItem(`wq_${table}`, JSON.stringify(data));
};

// Simple query builder that operates on localStorage
class QueryBuilder {
  private table: string;
  private data: any[];
  private filters: Array<(item: any) => boolean> = [];
  private selectFields: string | null = null;
  private orderField: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private isCount: boolean = false;
  private isHead: boolean = false;
  private isInsert: boolean = false;
  private isUpdate: boolean = false;
  private isDelete: boolean = false;
  private insertData: any = null;
  private updateData: any = null;
  private returnData: boolean = false;

  constructor(table: string) {
    this.table = table;
    this.data = getStore(table);
  }

  select(fields?: string, options?: { count?: string; head?: boolean }) {
    this.selectFields = fields || "*";
    if (options?.count === "exact") this.isCount = true;
    if (options?.head) this.isHead = true;
    return this;
  }

  insert(data: any | any[]) {
    this.isInsert = true;
    const items = Array.isArray(data) ? data : [data];
    this.insertData = items.map(item => ({
      id: item.id || crypto.randomUUID(),
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item,
    }));
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.updateData = { ...data, updated_at: new Date().toISOString() };
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }) {
    this.isInsert = true;
    const conflictField = options?.onConflict || 'id';
    const items = Array.isArray(data) ? data : [data];
    const current = getStore(this.table);
    
    this.insertData = items.map(item => {
      const existing = current.find((row: any) => row[conflictField] === item[conflictField]);
      if (existing) {
        return { ...existing, ...item, updated_at: new Date().toISOString() };
      }
      return {
        id: item.id || crypto.randomUUID(),
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      };
    });
    
    // Remove existing conflicting rows
    this.data = current.filter((row: any) => 
      !items.some(item => row[conflictField] === item[conflictField])
    );
    // We'll handle the merge in execute
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push(item => item[field] !== value);
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push(item => item[field] > value);
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push(item => item[field] >= value);
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push(item => item[field] < value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push(item => item[field] <= value);
    return this;
  }

  ilike(field: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push(item => regex.test(item[field] || ''));
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push(item => values.includes(item[field]));
    return this;
  }

  is(field: string, value: any) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  or(filter: string) {
    // Simple OR filter parsing for common patterns
    const parts = filter.split(',');
    this.filters.push(item => {
      return parts.some(part => {
        const eqMatch = part.match(/(\w+)\.eq\.(.+)/);
        if (eqMatch) return item[eqMatch[1]] === eqMatch[2];
        return false;
      });
    });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(resolve: (result: any) => void) {
    resolve(await this.execute());
  }

  async execute(): Promise<any> {
    // Handle insert
    if (this.isInsert && this.insertData) {
      const current = getStore(this.table);
      current.push(...this.insertData);
      setStore(this.table, current);
      
      if (this.returnData || this.isSingle) {
        return { data: this.isSingle ? this.insertData[0] : this.insertData, error: null };
      }
      return { data: this.insertData, error: null };
    }

    // Handle update
    if (this.isUpdate && this.updateData) {
      const current = getStore(this.table);
      let updated: any[] = [];
      const result = current.map(item => {
        const matches = this.filters.every(f => f(item));
        if (matches) {
          const updatedItem = { ...item, ...this.updateData };
          updated.push(updatedItem);
          return updatedItem;
        }
        return item;
      });
      setStore(this.table, result);
      return { data: updated, error: null };
    }

    // Handle delete
    if (this.isDelete) {
      const current = getStore(this.table);
      const result = current.filter(item => !this.filters.every(f => f(item)));
      setStore(this.table, result);
      return { data: null, error: null };
    }

    // Handle select
    let result = [...this.data];

    // Apply filters
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    // Apply ordering
    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAsc;
      result.sort((a, b) => {
        const va = a[field], vb = b[field];
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
    }

    // Apply range
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    }

    // Apply limit
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Handle count
    if (this.isCount && this.isHead) {
      return { data: null, count: result.length, error: null };
    }

    // Handle single
    if (this.isSingle) {
      return { data: result[0] || null, error: result[0] ? null : { message: 'Not found' } };
    }

    if (this.isMaybeSingle) {
      return { data: result[0] || null, error: null };
    }

    return { data: result, error: null };
  }
}

// Auth state management
type AuthChangeCallback = (event: string, session: any) => void;
const authCallbacks: AuthChangeCallback[] = [];
let currentSession: any = null;

const loadSession = () => {
  try {
    const saved = localStorage.getItem('wq_auth_session');
    if (saved) {
      currentSession = JSON.parse(saved);
    }
  } catch { currentSession = null; }
};

loadSession();

const notifyAuthChange = (event: string, session: any) => {
  authCallbacks.forEach(cb => cb(event, session));
};

// Mock Supabase client
export const supabase = {
  from: (table: string) => {
    const qb = new QueryBuilder(table);
    // Return a proxy that allows chaining and auto-execution
    return qb;
  },

  auth: {
    getSession: async () => {
      return { data: { session: currentSession }, error: null };
    },

    getUser: async () => {
      return { data: { user: currentSession?.user || null }, error: null };
    },

    onAuthStateChange: (callback: AuthChangeCallback) => {
      authCallbacks.push(callback);
      // Immediately notify with current state
      setTimeout(() => callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession), 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authCallbacks.indexOf(callback);
              if (idx >= 0) authCallbacks.splice(idx, 1);
            },
          },
        },
      };
    },

    signUp: async ({ email, password }: { email: string; password: string }) => {
      const userId = crypto.randomUUID();
      const user = { id: userId, email, created_at: new Date().toISOString() };
      const session = { user, access_token: `mock_${userId}`, refresh_token: `refresh_${userId}` };
      
      // Save user to local store
      const users = getStore('auth_users');
      users.push({ ...user, password });
      setStore('auth_users', users);

      currentSession = session;
      localStorage.setItem('wq_auth_session', JSON.stringify(session));
      notifyAuthChange('SIGNED_IN', session);
      
      return { data: { user, session }, error: null };
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const users = getStore('auth_users');
      const user = users.find((u: any) => u.email === email && u.password === password);
      
      if (!user) {
        return { data: { user: null, session: null }, error: { message: '邮箱或密码错误' } };
      }

      const session = { user: { id: user.id, email: user.email }, access_token: `mock_${user.id}`, refresh_token: `refresh_${user.id}` };
      currentSession = session;
      localStorage.setItem('wq_auth_session', JSON.stringify(session));
      notifyAuthChange('SIGNED_IN', session);
      
      return { data: { user: { id: user.id, email: user.email }, session }, error: null };
    },

    signInWithOtp: async ({ email }: { email: string }) => {
      // Auto-create account and sign in for OTP
      const users = getStore('auth_users');
      let user = users.find((u: any) => u.email === email);
      
      if (!user) {
        const userId = crypto.randomUUID();
        user = { id: userId, email, password: '', created_at: new Date().toISOString() };
        users.push(user);
        setStore('auth_users', users);
      }

      const session = { user: { id: user.id, email: user.email }, access_token: `mock_${user.id}`, refresh_token: `refresh_${user.id}` };
      currentSession = session;
      localStorage.setItem('wq_auth_session', JSON.stringify(session));
      notifyAuthChange('SIGNED_IN', session);
      
      return { data: { user: { id: user.id, email: user.email }, session }, error: null };
    },

    signOut: async () => {
      currentSession = null;
      localStorage.removeItem('wq_auth_session');
      notifyAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  },

  channel: (name: string, _config?: any) => {
    // Mock realtime channel - no-op
    const channel = {
      on: (_event: string, _filter: any, _callback?: any) => channel,
      subscribe: (callback?: (status: string) => void) => {
        if (callback) setTimeout(() => callback('SUBSCRIBED'), 10);
        return channel;
      },
      unsubscribe: () => {},
      track: async (_data: any) => {},
      presenceState: () => ({}),
    };
    return channel;
  },

  removeChannel: async (_channel: any) => {},

  rpc: async (fnName: string, params?: any) => {
    // Mock RPC calls - return empty results
    console.log(`[Mock] RPC call: ${fnName}`, params);
    return { data: [], error: null };
  },

  functions: {
    invoke: async (fnName: string, _options?: any) => {
      console.log(`[Mock] Edge function call: ${fnName}`);
      return { data: null, error: null };
    },
  },

  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File, _options?: any) => {
        // Store file as data URL in localStorage
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const files = getStore(`storage_${bucket}`);
            files.push({ path, dataUrl: reader.result, name: file.name });
            setStore(`storage_${bucket}`, files);
            resolve({ data: { path }, error: null });
          };
          reader.readAsDataURL(file);
        });
      },
      getPublicUrl: (path: string) => {
        const files = getStore(`storage_${bucket}`);
        const file = files.find((f: any) => f.path === path);
        return { data: { publicUrl: file?.dataUrl || `/placeholder.svg` } };
      },
      remove: async (paths: string[]) => {
        const files = getStore(`storage_${bucket}`);
        const result = files.filter((f: any) => !paths.includes(f.path));
        setStore(`storage_${bucket}`, result);
        return { data: null, error: null };
      },
    }),
  },
};

export type { Json };
