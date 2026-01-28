# 🔐 FoodWaste App - Admin Panel

## ✅ สร้างระบบ Admin สำเร็จแล้ว!

### 📱 **หน้าจอ Admin ที่สร้างครบ (4 หน้า)**

#### 1. **AdminHomeScreen.js** - Dashboard หลัก
- **สถิติภาพรวม:**
  - ผู้ใช้ทั้งหมด
  - ร้านค้าทั้งหมด
  - คำสั่งซื้อทั้งหมด
  - รายได้รวม
  - รออนุมัติ
- **เมนูด่วน:**
  - จัดการบัญชี
  - อนุมัติ/ปฏิเสธ
  - รายงาน
  - ตั้งค่าระบบ
- **กิจกรรมล่าสุด**
- Bottom Navigation

#### 2. **AdminUsersScreen.js** - จัดการบัญชีผู้ใช้
- **ค้นหา:** ชื่อหรืออีเมล
- **Filter:** ทั้งหมด / ลูกค้า / ร้านค้า
- **แสดงข้อมูล:**
  - รูปโปรไฟล์
  - ชื่อผู้ใช้
  - อีเมล
  - เบอร์โทร
  - โรล (ลูกค้า/ร้านค้า)
- **ฟีเจอร์:**
  - ✅ **ดูรายละเอียดบัญชี** (Modal)
  - ✅ **เปลี่ยนโรล** (Customer ↔ Store)
  - ✅ **ลบบัญชี** (พร้อม Confirmation)
- Bottom Navigation

#### 3. **AdminApprovalsScreen.js** - อนุมัติ/ปฏิเสธคำขอ
- **แท็บ:**
  - รออนุมัติ
  - อนุมัติแล้ว
  - ปฏิเสธแล้ว
- **ประเภทคำขอ:**
  - ลงทะเบียนร้านค้า (สีฟ้า)
  - ลงขายอาหาร (สีเขียว)
  - โปรโมชั่น (สีส้ม)
- **ฟีเจอร์:**
  - ✅ **ดูรายละเอียดคำขอ** (Modal)
  - ✅ **ระบุเหตุผล** (ถ้าปฏิเสธ - Required)
  - ✅ **อนุมัติ** (ปุ่มเขียว)
  - ✅ **ปฏิเสธ** (ปุ่มแดง + ต้องมีเหตุผล)
- Bottom Navigation

#### 4. **AdminReportsScreen.js** - รายงานและสถิติ
- **เลือกช่วงเวลา:**
  - สัปดาห์นี้
  - เดือนนี้
  - ปีนี้
- **สรุปภาพรวม:**
  - รายได้รวม (+12%)
  - คำสั่งซื้อ (+8%)
  - ร้านค้าทั้งหมด (+5%)
  - ค่าเฉลี่ย/คำสั่ง (-3%)
- **TOP 5 ร้านค้า:**
  - แสดงอันดับ 1-5
  - ชื่อร้าน
  - จำนวนคำสั่งซื้อ
  - รายได้ (บาท)
  - เหรียญ (อันดับ 1-3)
- **กราฟ:** (Placeholder)
  - รายได้รายวัน
  - คำสั่งซื้อรายเดือน
- Bottom Navigation

---

## 📂 **โครงสร้างไฟล์**

```
screens-admin/
├── AdminHomeScreen.js         ✅
├── AdminUsersScreen.js        ✅
├── AdminApprovalsScreen.js    ✅
└── AdminReportsScreen.js      ✅

App-Updated.js                 ✅ (รองรับ Admin routes)
```

---

## 🎯 **Admin Features Checklist**

### ✅ **จัดการบัญชี (AdminUsersScreen)**
- [x] ดูบัญชีทั้งหมด (Customer + Store)
- [x] ค้นหาตามชื่อ/อีเมล
- [x] กรองตามโรล (All/Customer/Store)
- [x] ดูรายละเอียดบัญชี
- [x] **เปลี่ยนโรล** (Customer ↔ Store)
- [x] **ลบบัญชี** (พร้อม Alert)

### ✅ **อนุมัติ/ปฏิเสธ (AdminApprovalsScreen)**
- [x] แสดงคำขอทั้งหมด
- [x] กรองตามสถานะ (Pending/Approved/Rejected)
- [x] ดูรายละเอียดคำขอ
- [x] **อนุมัติคำขอ**
- [x] **ปฏิเสธคำขอ + ระบุเหตุผล (Required)**
- [x] บันทึกประวัติ (ใคร/เมื่อไหร่)

### ✅ **รายงานและสถิติ (AdminReportsScreen)**
- [x] สรุปภาพรวม (รายได้/คำสั่ง/ร้าน)
- [x] **TOP 5 ร้านค้า** (ตาม Wireframe)
- [x] แสดง % เปลี่ยนแปลง
- [x] เลือกช่วงเวลา (Week/Month/Year)
- [x] Export button (Placeholder)
- [x] กราฟ (Placeholder)

---

## 🎨 **UI/UX Design**

### **สีและไอคอน:**
```javascript
const adminColors = {
  primary: '#1f2937',      // เทาเข้ม
  blue: '#3b82f6',         // สถิติ
  green: '#10b981',        // อนุมัติ/รายได้
  red: '#ef4444',          // ปฏิเสธ/ลบ
  orange: '#f59e0b',       // รออนุมัติ
  purple: '#8b5cf6',       // รายได้
};
```

### **Navigation:**
```
Bottom Nav (4 แท็บ):
┌──────────┬──────────┬──────────┬──────────┐
│  หน้าหลัก │   บัญชี   │  รายงาน  │ โปรไฟล์  │
│   🏠     │   👥     │    📊    │   👤    │
└──────────┴──────────┴──────────┴──────────┘
```

---

## 🗄️ **Database Schema**

### **users** (เดิม + Admin fields)
```javascript
{
  userId: string,
  username: string,
  email: string,
  phoneNumber: string,
  currentRole: 'customer' | 'store' | 'admin',  // เพิ่ม 'admin'
  isAdmin: boolean,  // ใหม่
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

### **approval_requests** (ใหม่)
```javascript
{
  requestId: string,
  type: 'store_registration' | 'food_listing' | 'promotion',
  userId: string,
  userName: string,
  userEmail: string,
  status: 'pending' | 'approved' | 'rejected',
  details: object,  // ข้อมูลเฉพาะแต่ละประเภท
  requestDate: timestamp,
  approvedBy: string | null,
  approvedDate: timestamp | null,
  rejectReason: string | null,
}
```

### **revenue_reports** (ใหม่)
```javascript
{
  reportId: string,
  storeId: string,
  storeName: string,
  period: 'week' | 'month' | 'year',
  revenue: number,
  orders: number,
  createdAt: timestamp,
}
```

---

## 🚀 **วิธีใช้งาน**

### 1. **ติดตั้งไฟล์**
```bash
# Copy admin screens
cp screens-admin/* your-project/screens-admin/

# Update App.js
cp App-Updated.js your-project/App.js
```

### 2. **ตั้งค่า Admin User**
```javascript
// ในฐานข้อมูล Firestore
// เพิ่ม field ให้กับ user ที่ต้องการเป็น Admin
{
  userId: "xxx",
  isAdmin: true,
  currentRole: "admin"
}
```

### 3. **เข้าถึง Admin Panel**
```javascript
// ใน HomeScreen หรือ MenuScreen
// เพิ่มปุ่มสำหรับ Admin
{userData?.isAdmin && (
  <TouchableOpacity 
    onPress={() => navigation.navigate('AdminHome')}
  >
    <Text>Admin Panel</Text>
  </TouchableOpacity>
)}
```

---

## 🔐 **Security & Permissions**

### **ตรวจสอบสิทธิ์:**
```javascript
// ใน Admin screens
useEffect(() => {
  checkAdminPermission();
}, []);

const checkAdminPermission = async () => {
  const user = auth.currentUser;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  
  if (!userDoc.data()?.isAdmin) {
    Alert.alert('ข้อผิดพลาด', 'คุณไม่มีสิทธิ์เข้าถึง');
    navigation.goBack();
  }
};
```

### **Firebase Rules:**
```javascript
// ใน Firestore Rules
match /users/{userId} {
  // Admin สามารถอ่าน/เขียนได้ทั้งหมด
  allow read, write: if request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}
```

---

## 💡 **Key Features Explained**

### 1. **เปลี่ยนโรล (Role Switching)**
```javascript
// AdminUsersScreen.js
const handleToggleRole = async (userId, currentRole) => {
  const newRole = currentRole === 'customer' ? 'store' : 'customer';
  
  await updateDoc(doc(db, 'users', userId), {
    currentRole: newRole,
  });
};
```

### 2. **อนุมัติ/ปฏิเสธ พร้อมเหตุผล**
```javascript
// AdminApprovalsScreen.js
const handleReject = () => {
  if (!rejectReason.trim()) {
    Alert.alert('ข้อผิดพลาด', 'กรุณาระบุเหตุผลในการปฏิเสธ');
    return;
  }
  // Proceed with rejection
};
```

### 3. **TOP 5 Rankings**
```javascript
// AdminReportsScreen.js
const topStores = [
  { rank: 1, name: 'ครัวคุณแม่', revenue: 5600, orders: 342 },
  { rank: 2, name: 'ร้านอาหารตามสั่ง', revenue: 5200, orders: 259 },
  // ...
];

// แสดง Medal สำหรับ Top 3
{store.rank <= 3 && (
  <Ionicons
    name={store.rank === 1 ? 'trophy' : 'medal'}
    color={store.rank === 1 ? '#f59e0b' : '#9ca3af'}
  />
)}
```

---

## 📊 **Statistics Calculation**

```javascript
// คำนวณสถิติจริงจาก Firestore
const loadStats = async () => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  
  let totalRevenue = 0;
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    if (order.status === 'completed') {
      totalRevenue += order.price || 0;
    }
  });

  setStats({
    totalUsers: usersSnapshot.size,
    totalOrders: ordersSnapshot.size,
    totalRevenue: totalRevenue,
  });
};
```

---

## 🎯 **Future Enhancements**

### **สิ่งที่สามารถเพิ่มได้:**
1. **กราฟจริง** - ใช้ `react-native-chart-kit` หรือ `victory-native`
2. **Export Reports** - Export เป็น PDF/Excel
3. **Push Notifications** - แจ้งเตือนเมื่อมีคำขอใหม่
4. **Activity Logs** - บันทึกทุกการกระทำของ Admin
5. **Advanced Filters** - กรองตามวันที่, ราคา, สถานะ
6. **Bulk Actions** - อนุมัติ/ปฏิเสธหลายรายการพร้อมกัน
7. **Email Notifications** - ส่งอีเมลแจ้งผู้ใช้เมื่อถูกอนุมัติ/ปฏิเสธ

---

## ✨ **สรุป**

✅ สร้างหน้าจอ Admin ครบ 4 หน้า  
✅ **จัดการบัญชี** - ดู/แก้/ลบ/เปลี่ยนโรล  
✅ **อนุมัติ/ปฏิเสธ** - พร้อมระบุเหตุผล (Required)  
✅ **รายงาน** - TOP 5 + สถิติครบ  
✅ UI ตาม Wireframe  
✅ Bottom Navigation ทุกหน้า  

**พร้อมใช้งานเลย!** 🚀

---

## 📝 **Notes**

- Admin Panel ต้องมีการตรวจสอบสิทธิ์
- ข้อมูล TOP 5 เป็น Mock data (ใช้ข้อมูลจริงจาก Firestore)
- กราฟเป็น Placeholder (ใช้ Chart library จริง)
- ต้องเพิ่ม Admin role ใน Firebase Authentication

**Happy Coding!** 💻
