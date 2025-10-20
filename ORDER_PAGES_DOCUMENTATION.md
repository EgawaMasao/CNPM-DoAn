# Order Pages Documentation

## Two Separate Order Views

### 1. Customer Order History (`/customer/order-history`)
**File:** `frontend/src/pages/customer/CustomerOrderHistory.js`

**Purpose:** 
- Shows orders for the CURRENTLY LOGGED-IN customer only
- Personal order history page

**Features:**
- ✅ Beautiful card-based layout
- ✅ Color-coded status badges (Pending, Confirmed, Preparing, Out for Delivery, Delivered, Canceled)
- ✅ Search by restaurant or address
- ✅ Shows order date and time
- ✅ Lists all items in each order
- ✅ Shows order total
- ✅ "View Details" button for each order
- ✅ Loading state
- ✅ Empty state with "Start Shopping" button

**Authentication:**
- Requires login (uses token from localStorage)
- Automatically redirects to `/auth/login` if not logged in
- Only shows orders for the logged-in customer

**Access:**
- URL: `/customer/order-history`
- For: Customers
- Shows: Only THEIR orders

**Design:**
- Modern card-based layout
- Mobile-friendly
- Color-coded status indicators
- Clean and professional look

---

### 2. Admin Order View (`/orders`)
**File:** `frontend/src/pages/orderManagement/OrderHome.js`

**Purpose:**
- Shows ALL orders from ALL customers (admin/superadmin view)
- For restaurant management and order oversight

**Features:**
- ✅ Table-based layout
- ✅ Search by Restaurant ID
- ✅ Shows all customer orders
- ✅ Edit, Delete, and View options for each order
- ✅ Filters out canceled orders
- ✅ Cart button for quick access

**Authentication:**
- Requires login (uses token from localStorage)
- Should be restricted to admin/superadmin roles (not enforced yet)

**Access:**
- URL: `/orders`
- For: Admins/Superadmins
- Shows: ALL orders from ALL customers

**Design:**
- Traditional table layout
- Action buttons for management
- Suitable for admin operations

---

## Key Differences

| Feature | Customer Order History | Admin Order View |
|---------|----------------------|------------------|
| **URL** | `/customer/order-history` | `/orders` |
| **User** | Customers | Admins/Superadmins |
| **Orders Shown** | Only customer's own orders | ALL orders from all customers |
| **Layout** | Card-based, modern | Table-based, traditional |
| **Actions** | View details only | Edit, Delete, View |
| **Status Display** | Color-coded badges | Text only |
| **Search** | By restaurant or address | By restaurant ID |

---

## Usage

### For Customers:
1. Login at `/auth/login`
2. Navigate to `/customer/order-history`
3. View your personal order history
4. Click "View Details" to see full order information

### For Admins:
1. Login with admin credentials
2. Navigate to `/orders`
3. View all orders from all customers
4. Manage orders (edit, delete, view details)

---

## Authentication Flow

Both pages use the same authentication mechanism:

```javascript
const token = localStorage.getItem('token'); // Get token from login
```

The token is set during login:
```javascript
// In AuthLogin.jsx
localStorage.setItem("token", res.data.token);
```

If no token is found, users are redirected to `/auth/login`.

---

## Future Enhancements

### Customer Order History:
- [ ] Add order tracking timeline
- [ ] Allow order cancellation (for pending orders)
- [ ] Add reorder functionality
- [ ] Show estimated delivery time
- [ ] Add order rating/review

### Admin Order View:
- [ ] Add role-based access control
- [ ] Implement order status updates
- [ ] Add bulk operations
- [ ] Export orders to CSV
- [ ] Add advanced filters (date range, status, customer)
- [ ] Real-time order updates

---

## Price Display

**Important:** Prices are stored in cents (minor currency units) in the database.

To display correctly:
```javascript
${(price / 100).toFixed(2)} // Converts cents to dollars
```

Example:
- Database: `7656` (cents)
- Display: `$76.56`

---

## Testing

### Test Customer Order History:
1. Login as a customer
2. Create an order through the payment flow
3. Go to `/customer/order-history`
4. Verify your order appears
5. Test search functionality
6. Click "View Details"

### Test Admin Order View:
1. Login as admin
2. Go to `/orders`
3. Verify all customer orders appear
4. Test search by restaurant ID
5. Test edit/delete/view actions
