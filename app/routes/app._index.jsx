import { useState } from "react";
import { useLoaderData, useSubmit } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Text,
  BlockStack,
  Box,
  Badge,
  AppProvider,
  IndexTable,
  InlineStack,
  Modal,
  TextContainer,
  Tooltip
} from "@shopify/polaris";
import { DeleteIcon, EditIcon, PlusIcon, CheckIcon } from "@shopify/polaris-icons";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import db from "../db.server";

// 1. FETCH DATA
export const loader = async () => {
  try {
    const tickets = await db.ticket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return tickets;
  } catch (error) {
    return [];
  }
};

// 2. ACTION
export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  const id = formData.get("id");
  const title = formData.get("title");
  const description = formData.get("description");

  // A. DELETE
  if (intent === "delete") {
    await db.ticket.delete({ where: { id } });
    return { success: true };
  }

  // B. MARK AS DONE
  if (intent === "mark_done") {
    await db.ticket.update({
      where: { id },
      data: { status: "FULFILLED" }
    });
    return { success: true };
  }

  // C. UPDATE
  if (intent === "update") {
    await db.ticket.update({
      where: { id },
      data: { title, description }
    });
    return { success: true };
  }

  // D. CREATE
  if (!title) return null;

  // Auto-Detect Inquiry
  let autoInquiry = "General";
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("money") || lowerTitle.includes("price") || lowerTitle.includes("refund")) {
    autoInquiry = "Sales";
  } else if (lowerTitle.includes("error") || lowerTitle.includes("bug") || lowerTitle.includes("login") || lowerTitle.includes("fail")) {
    autoInquiry = "Technical";
  } else if (lowerTitle.includes("ship") || lowerTitle.includes("order") || lowerTitle.includes("delivery")) {
    autoInquiry = "Logistics";
  }

  await db.ticket.create({
    data: { 
        title, 
        description, 
        status: "OPEN", 
        inquiry: autoInquiry 
    }
  });

  return { success: true };
};

// 3. SCREEN
export default function Index() {
  const tickets = useLoaderData();
  const submit = useSubmit();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [idToDelete, setIdToDelete] = useState(null);

  // --- FUNCTIONS ---
  const handleCreateBtn = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setIsFormModalOpen(true);
  };

  const handleEditBtn = (ticket) => {
    setEditingId(ticket.id);
    setTitle(ticket.title);
    setDescription(ticket.description || "");
    setIsFormModalOpen(true);
  };

  const handleMarkDone = (id) => {
    submit({ intent: "mark_done", id }, { method: "post" });
  };

  const handleFormSubmit = () => {
    if (editingId) {
      submit({ intent: "update", id: editingId, title, description }, { method: "post" });
    } else {
      submit({ intent: "create", title, description }, { method: "post" });
    }
    setIsFormModalOpen(false);
  };

  const handleDeleteBtn = (id) => {
    setIdToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (idToDelete) {
      submit({ intent: "delete", id: idToDelete }, { method: "post" });
      setIsDeleteModalOpen(false);
      setIdToDelete(null);
    }
  };

  const resourceName = { singular: 'ticket', plural: 'tickets' };
  
  const rowMarkup = tickets.map(
    (ticket, index) => (
      <IndexTable.Row id={ticket.id} key={ticket.id} position={index}>
        <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold">#{ticket.id.substring(0, 8)}...</Text></IndexTable.Cell>
        <IndexTable.Cell>{new Date(ticket.createdAt).toLocaleDateString()}</IndexTable.Cell>
        
        <IndexTable.Cell>
            <Badge tone={ticket.inquiry === 'Technical' ? 'critical' : (ticket.inquiry === 'Sales' ? 'attention' : 'info')}>
                {ticket.inquiry}
            </Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
            <Badge tone={ticket.status === 'OPEN' ? 'success' : 'base'}>
                {ticket.status}
            </Badge>
        </IndexTable.Cell>

   
        
        <IndexTable.Cell>
            <InlineStack gap="200">
                {ticket.status === 'OPEN' && (
                    <Tooltip content="Mark as Solved">
                        <Button icon={CheckIcon} tone="success" onClick={() => handleMarkDone(ticket.id)} />
                    </Tooltip>
                )}
                <Button icon={EditIcon} onClick={() => handleEditBtn(ticket)} accessibilityLabel="Edit" />
                <Button icon={DeleteIcon} tone="critical" onClick={() => handleDeleteBtn(ticket.id)} accessibilityLabel="Delete" />
            </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <AppProvider i18n={enTranslations}>
      <Page 
        title="Support Tickets" 
        primaryAction={{
            content: "Create Ticket",
            icon: PlusIcon,
            onAction: handleCreateBtn
        }}
      >
        <Layout>
          <Layout.Section>
            <Card padding="0">
                {tickets.length === 0 ? (
                    <Box padding="400">
                        <Text tone="subdued" alignment="center">No tickets found.</Text>
                    </Box>
                ) : (
                    <IndexTable
                    resourceName={resourceName}
                    itemCount={tickets.length}
                    headings={[
                        {title: 'ID'},
                        {title: 'Date'},
                        {title: 'Inquiry'},
                        {title: 'Status'},
                        {title: 'Actions'},
                    ]}
                    selectable={false}
                    >
                    {rowMarkup}
                    </IndexTable>
                )}
            </Card>
          </Layout.Section>
        </Layout>

        {/* --- FORM MODAL --- */}
        <Modal
          open={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingId ? "Edit Ticket" : "Create New Ticket"}
          primaryAction={{
            content: editingId ? 'Update' : 'Save',
            onAction: handleFormSubmit,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setIsFormModalOpen(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField 
                label="Ticket Title" 
                value={title} 
                onChange={setTitle} 
                autoComplete="off" 
                placeholder="e.g. Login Issue"
              />
              <TextField 
                label="Description" 
                value={description} 
                onChange={setDescription} 
                autoComplete="off" 
                multiline={4} 
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* --- DELETE MODAL --- */}
        <Modal
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Ticket?"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: confirmDelete,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setIsDeleteModalOpen(false) }]}
        >
          <Modal.Section>
            <TextContainer>
              <p>Are you sure you want to delete this ticket? This action cannot be undone.</p>
            </TextContainer>
          </Modal.Section>
        </Modal>

      </Page>
    </AppProvider>
  );
}