export let mockUsers = [
  { id: 'u1', name: 'Super Admin', username: 'admin', password: 'admin', role: 'SUPER_ADMIN' }
];

export let mockClients = [
  { id: '1', name: 'Acme Corp', taxId: 'TAX123', phone: '555-0100', email: 'contact@acme.com', clientType: 'COMPANY', createdAt: new Date().toISOString() },
  { id: '2', name: 'John Doe', taxId: '', phone: '555-0101', email: 'john@example.com', clientType: 'INDIVIDUAL', createdAt: new Date().toISOString() }
];

export let mockEnquiries = [
  { id: '1', enquiryNumber: 'ENQ-001', clientId: '1', clientName: 'Acme Corp', rating: 'HOT_LEAD', notes: 'Needs 50 office chairs ASAP.', items: [{ id: 'i1', description: 'Office Chair', quantity: 50, unitPrice: 0, total: 0 }], createdAt: new Date().toISOString() },
  { id: '2', enquiryNumber: 'ENQ-002', clientId: '2', clientName: 'John Doe', rating: 'POOR_LEAD', notes: 'Just asking for a single custom chair, low budget.', items: [{ id: 'i2', description: 'Custom Chair', quantity: 1, unitPrice: 0, total: 0 }], createdAt: new Date().toISOString() }
];

export let mockQuotations = [
  { 
    id: '1', 
    quotationNumber: 'QT-001', 
    clientId: '1', 
    clientName: 'Acme Corp', 
    status: 'SENT', 
    totalAmount: 1500.00,
    items: [
      { id: 'i1', description: 'Office Chair', quantity: 10, unitPrice: 150.00, total: 1500.00 }
    ],
    createdAt: new Date().toISOString() 
  }
];
