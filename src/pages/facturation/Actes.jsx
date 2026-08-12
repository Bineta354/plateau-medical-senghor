import React, { useState, useEffect } from 'react';
import { useTypesActes } from '../../hooks/useTypesActes';
import { supabase } from '../../lib/supabase';
import { formatMontantDecimal } from '../../utils/currency';
import {
    listConsultationsForDropdown,
    listTarifsActifs,
    listActesConsultation,
    createActeConsultation,
    updateActeConsultation,
    deleteActeConsultation,
} from '../../services/acteConsultationService';
import { motion } from 'framer-motion';
import { formatMontant } from '../../utils/currency';
import KpiCard from '../../components/common/KpiCard';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    BanknotesIcon,
    DocumentTextIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

const ActesPage = () => {
    const [actes, setActes] = useState([]);
    const [consultations, setConsultations] = useState([]);
    
    // Utilisation du hook pour les types d'actes
    const { typesActes, loading: loadingTypesActes } = useTypesActes();
    
    const [tarifs, setTarifs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingActe, setEditingActe] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterConsultation, setFilterConsultation] = useState('');

    // État du formulaire
    const [formData, setFormData] = useState({
        consultation_id: '',
        type_acte_id: '',
        quantite: 1,
        tarif_unitaire: 0,
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Récupérer les consultations
            const consultationsData = await listConsultationsForDropdown();
            setConsultations(consultationsData);

            // Les types d'actes sont gérés par le hook useTypesActes

            // Récupérer les tarifs
            const tarifsData = await listTarifsActifs();
            setTarifs(tarifsData);

            // Récupérer les actes
            await fetchActes();

        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActes = async () => {
        try {
            const data = await listActesConsultation();
            setActes(data);
        } catch (error) {
            console.error('Erreur lors du chargement des actes:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const acteData = {
                ...formData,
                created_by: (await supabase.auth.getUser()).data.user?.id
            };

            if (editingActe) {
                await updateActeConsultation(editingActe.id, acteData);
            } else {
                await createActeConsultation(acteData);
            }

            setShowModal(false);
            setEditingActe(null);
            resetForm();
            fetchActes();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        }
    };

    const handleEdit = (acte) => {
        setEditingActe(acte);
        setFormData({
            consultation_id: acte.consultation_id,
            type_acte_id: acte.type_acte_id,
            quantite: acte.quantite,
            tarif_unitaire: acte.tarif_unitaire,
            notes: acte.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet acte ?')) {
            try {
                await deleteActeConsultation(id);
                fetchActes();
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            consultation_id: '',
            type_acte_id: '',
            quantite: 1,
            tarif_unitaire: 0,
            notes: ''
        });
    };

    const handleTypeActeChange = (typeActeId) => {
        const selectedTarif = tarifs.find(t => t.type_acte_id === parseInt(typeActeId));
        setFormData(prev => ({
            ...prev,
            type_acte_id: typeActeId,
            tarif_unitaire: selectedTarif ? selectedTarif.tarif_base : 0
        }));
    };

    const filteredActes = actes.filter(acte => {
        const matchesSearch = 
            acte.consultations?.patients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acte.consultations?.patients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acte.types_actes?.nom?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesConsultation = !filterConsultation || acte.consultation_id === parseInt(filterConsultation);
        
        return matchesSearch && matchesConsultation;
    });

    const totalMontant = filteredActes.reduce((sum, acte) => sum + acte.montant_total, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* En-tête */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <DocumentTextIcon className="h-8 w-8 mr-3 text-blue-600" />
                            Gestion des Actes
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Gestion des actes pratiqués lors des consultations avec tarification
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nouvel Acte
                    </button>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard icon={DocumentTextIcon} tone="blue" label="Total Actes" value={filteredActes.length} />
                    <KpiCard icon={BanknotesIcon} tone="green" label="Montant Total" value={formatMontant(totalMontant)} />
                    <KpiCard
                        icon={ClockIcon}
                        label="Consultations"
                        value={new Set(filteredActes.map(a => a.consultation_id)).size}
                        className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
                        iconClassName="text-orange-600"
                        valueClassName="text-orange-600"
                        labelClassName="text-orange-700"
                    />
                </div>

                {/* Filtres */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rechercher
                            </label>
                            <input
                                type="text"
                                placeholder="Patient, type d'acte..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Consultation
                            </label>
                            <select
                                value={filterConsultation}
                                onChange={(e) => setFilterConsultation(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Toutes les consultations</option>
                                {consultations.map(consultation => (
                                    <option key={consultation.id} value={consultation.id}>
                                        {consultation.patients?.nom} {consultation.patients?.prenom} - 
                                        {new Date(consultation.date_consultation).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tableau des actes */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Patient
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date Consultation
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type d&apos;Acte
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Quantité
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tarif Unitaire
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Montant Total
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredActes.map((acte) => (
                                    <tr key={acte.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {acte.consultations?.patients?.nom} {acte.consultations?.patients?.prenom}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {new Date(acte.consultations?.date_consultation).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {acte.types_actes?.nom}
                                            </div>
                                            {acte.types_actes?.description && (
                                                <div className="text-sm text-gray-500">
                                                    {acte.types_actes.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {acte.quantite}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {formatMontantDecimal(acte.tarif_unitaire)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-green-600">
                                                {formatMontantDecimal(acte.montant_total)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleEdit(acte)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(acte.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg p-8 max-w-md w-full mx-4"
                    >
                        <h2 className="text-2xl font-bold mb-6">
                            {editingActe ? 'Modifier l\'Acte' : 'Nouvel Acte'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Consultation
                                </label>
                                <select
                                    required
                                    value={formData.consultation_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, consultation_id: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Sélectionner une consultation</option>
                                    {consultations.map(consultation => (
                                        <option key={consultation.id} value={consultation.id}>
                                            {consultation.patients?.nom} {consultation.patients?.prenom} - 
                                            {new Date(consultation.date_consultation).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type d&apos;Acte
                                </label>
                                <select
                                    required
                                    value={formData.type_acte_id}
                                    onChange={(e) => handleTypeActeChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Sélectionner un type d&apos;acte</option>
                                    {typesActes.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.nom}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Quantité
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={formData.quantite}
                                    onChange={(e) => setFormData(prev => ({ ...prev, quantite: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tarif Unitaire (FCFA)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={formData.tarif_unitaire}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tarif_unitaire: parseFloat(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingActe(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    {editingActe ? 'Modifier' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ActesPage;
