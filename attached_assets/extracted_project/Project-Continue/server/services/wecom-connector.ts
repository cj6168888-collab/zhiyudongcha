interface WeComCredentials {
  corpId: string;
  corpSecret: string;
  agentId: string;
}

interface WeComAccessToken {
  access_token: string;
  expires_in: number;
  fetchedAt: number;
}

interface WeComUser {
  userid: string;
  name: string;
  department: number[];
  position?: string;
  mobile?: string;
  email?: string;
  avatar?: string;
}

interface WeComDepartment {
  id: number;
  name: string;
  parentid: number;
  order: number;
}

const tokenCache: Map<string, WeComAccessToken> = new Map();

export async function getAccessToken(credentials: WeComCredentials): Promise<string> {
  const cacheKey = `${credentials.corpId}_${credentials.agentId}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached) {
    const now = Date.now();
    const expiresAt = cached.fetchedAt + (cached.expires_in - 300) * 1000;
    if (now < expiresAt) {
      return cached.access_token;
    }
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${credentials.corpId}&corpsecret=${credentials.corpSecret}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(`WeCom auth failed: ${data.errmsg}`);
  }

  tokenCache.set(cacheKey, {
    access_token: data.access_token,
    expires_in: data.expires_in,
    fetchedAt: Date.now(),
  });

  return data.access_token;
}

export async function testConnection(credentials: WeComCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getAccessToken(credentials);
    return { success: true, message: `连接成功，Token已获取` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "连接失败" };
  }
}

export async function getDepartmentList(credentials: WeComCredentials): Promise<WeComDepartment[]> {
  const token = await getAccessToken(credentials);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${token}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(`获取部门列表失败: ${data.errmsg}`);
  }

  return data.department || [];
}

export async function getDepartmentUsers(credentials: WeComCredentials, departmentId: number, fetchChild = false): Promise<WeComUser[]> {
  const token = await getAccessToken(credentials);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/user/list?access_token=${token}&department_id=${departmentId}&fetch_child=${fetchChild ? 1 : 0}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(`获取用户列表失败: ${data.errmsg}`);
  }

  return data.userlist || [];
}

export async function getAllUsers(credentials: WeComCredentials): Promise<WeComUser[]> {
  const departments = await getDepartmentList(credentials);
  const rootDeptId = departments.find(d => d.parentid === 0)?.id || 1;
  return await getDepartmentUsers(credentials, rootDeptId, true);
}

export async function sendTextMessage(
  credentials: WeComCredentials,
  toUser: string | string[],
  content: string
): Promise<{ success: boolean; msgid?: string; error?: string }> {
  const token = await getAccessToken(credentials);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
  
  const userList = Array.isArray(toUser) ? toUser.join('|') : toUser;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: userList,
      msgtype: 'text',
      agentid: parseInt(credentials.agentId),
      text: { content },
    }),
  });
  
  const data = await response.json();
  
  if (data.errcode !== 0) {
    return { success: false, error: data.errmsg };
  }

  return { success: true, msgid: data.msgid };
}

export async function sendMarkdownMessage(
  credentials: WeComCredentials,
  toUser: string | string[],
  content: string
): Promise<{ success: boolean; msgid?: string; error?: string }> {
  const token = await getAccessToken(credentials);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
  
  const userList = Array.isArray(toUser) ? toUser.join('|') : toUser;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: userList,
      msgtype: 'markdown',
      agentid: parseInt(credentials.agentId),
      markdown: { content },
    }),
  });
  
  const data = await response.json();
  
  if (data.errcode !== 0) {
    return { success: false, error: data.errmsg };
  }

  return { success: true, msgid: data.msgid };
}

export function parseCredentials(data: Record<string, string>): WeComCredentials {
  return {
    corpId: data['企业ID (CorpId)'] || data['corpId'] || data['corp_id'] || '',
    corpSecret: data['应用Secret'] || data['corpSecret'] || data['corp_secret'] || '',
    agentId: data['应用AgentId'] || data['agentId'] || data['agent_id'] || '',
  };
}
