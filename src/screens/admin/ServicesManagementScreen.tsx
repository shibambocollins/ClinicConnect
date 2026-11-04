// src/screens/admin/ServiceManagementScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Dropdown } from '../../components/Dropdown';
import { StatusFilter, StatusFilterValue, matchesStatus } from '../../components/StatusFilter';

const DEPARTMENTS = [
  'General Medicine',
  'Nursing',
  'Pediatrics & Child Health',
  "Women's Health / OB-GYN",
  'Chronic Care / Internal Medicine',
  'Mental Health',
  'Pharmacy',
  'Laboratory / Diagnostics',
  'Radiology / Imaging',
] as const;

interface Service {
  id: string;
  service_name: string;
  clinic_id: string;
  clinic_name?: string;
  description: string;
  estimated_duration: string;
  department?: string | null;
  status: 'active' | 'inactive';
}

export default function ServiceManagementScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('active');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    service_name: '',
    clinic_id: '',
    description: '',
    estimated_duration: '',
    department: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch clinics (only active ones can be assigned a service)
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('id, clinic_name')
        .eq('status', 'active');

      setClinics(clinicsData?.map(c => ({ id: c.id, name: c.clinic_name })) || []);

      // Fetch ALL services; the status filter is applied in the UI
      const { data: servicesData, error } = await supabase
        .from('services')
        .select(`
          *,
          clinic:clinic_id (clinic_name)
        `)
        .order('service_name', { ascending: true });

      if (error) throw error;

      const formattedServices = servicesData?.map(s => ({
        ...s,
        clinic_name: s.clinic?.clinic_name || 'Unassigned',
      })) || [];

      setServices(formattedServices);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((service) => {
      if (!matchesStatus(service.status, statusFilter)) return false;
      if (!q) return true;
      return (
        (service.service_name || '').toLowerCase().includes(q) ||
        (service.clinic_name || '').toLowerCase().includes(q) ||
        (service.department || '').toLowerCase().includes(q)
      );
    });
  }, [services, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'active';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('active');
  };

  const clinicOptions = clinics.map(c => ({ label: c.name, value: c.id }));

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      service_name: service.service_name,
      clinic_id: service.clinic_id,
      description: service.description || '',
      estimated_duration: service.estimated_duration || '',
      department: service.department || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (serviceId: string, serviceName: string) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${serviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', serviceId);

              if (error) throw error;
              await fetchData();
              Alert.alert('Success', 'Service deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete service');
            }
          },
        },
      ]
    );
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.service_name.trim()) errors.service_name = 'Service name is required';
    if (!form.clinic_id) errors.clinic_id = 'Please select a clinic';
    if (!form.description.trim()) errors.description = 'Description is required';
    if (!form.estimated_duration.trim()) errors.estimated_duration = 'Estimated duration is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        service_name: form.service_name,
        clinic_id: form.clinic_id,
        description: form.description,
        estimated_duration: form.estimated_duration,
        department: form.department || null,
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', editingService.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert({
            ...payload,
            status: 'active',
          });

        if (error) throw error;
      }

      setModalVisible(false);
      setEditingService(null);
      setForm({
        service_name: '',
        clinic_id: '',
        description: '',
        estimated_duration: '',
        department: '',
      });
      await fetchData();
      Alert.alert('Success', `Service ${editingService ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save service');
    }
  };

  const renderServiceCard = (service: Service) => (
    <View key={service.id} style={[styles.serviceCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceInfo}>
          <Text style={[styles.serviceName, { color: theme.colors.text }]}>
            {service.service_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: service.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
            <Text style={styles.statusText}>
              {service.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={() => handleEdit(service)}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E53935' }]}
            onPress={() => handleDelete(service.id, service.service_name)}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.serviceDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color="#666" />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {service.clinic_name || 'Unassigned'}
          </Text>
        </View>
        {service.department ? (
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color="#666" />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
              {service.department}
            </Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {service.estimated_duration || 'Duration not set'}
          </Text>
        </View>
        {service.description && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
              {service.description}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.5]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Management</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingService(null);
              setForm({
                service_name: '',
                clinic_id: '',
                description: '',
                estimated_duration: '',
                department: '',
              });
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7C5C" />
            <Text style={styles.loadingText}>Loading services...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={fetchData} colors={['#6B7C5C']} />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredServices.length > 0 ? (
              filteredServices.map(renderServiceCard)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="medkit-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>No services found</Text>
                <Text style={styles.emptyText}>
                  {hasActiveFilters
                    ? 'No services match the current filters'
                    : 'No services registered yet'}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                    <Text style={styles.clearBtnText}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <Input
                label="Service Name"
                value={form.service_name}
                onChangeText={(v) => setForm({ ...form, service_name: v })}
                error={formErrors.service_name}
              />

              <Dropdown
                label="Clinic"
                value={form.clinic_id}
                options={clinicOptions.map(c => c.label)}
                onSelect={(value) => {
                  const clinic = clinics.find(c => c.name === value);
                  if (clinic) setForm({ ...form, clinic_id: clinic.id });
                }}
                error={formErrors.clinic_id}
              />

              <Dropdown
                label="Department"
                value={form.department}
                options={[...DEPARTMENTS]}
                onSelect={(value) => setForm({ ...form, department: value })}
                placeholder="Select department"
              />

              <Input
                label="Description"
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                error={formErrors.description}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              <Input
                label="Estimated Duration"
                value={form.estimated_duration}
                onChangeText={(v) => setForm({ ...form, estimated_duration: v })}
                error={formErrors.estimated_duration}
                placeholder="e.g., 30 min"
              />

              <Button
                title={editingService ? 'Update Service' : 'Add Service'}
                onPress={handleSave}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  addButton: {
    backgroundColor: '#6B7C5C',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333' },
  listContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  serviceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  serviceInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  serviceName: { fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, flex: 1 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  clearBtn: {
    marginTop: 16,
    backgroundColor: '#6B7C5C',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearBtnText: { color: '#FFF', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  modalButton: { marginTop: 8 },
  textArea: { height: 80, textAlignVertical: 'top' },
});