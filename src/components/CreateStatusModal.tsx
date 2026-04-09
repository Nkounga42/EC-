import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { CreatePost } from './CreatePost';
import { Button } from '@/components/ui/button';

interface CreateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusCreated: () => void;
}

export function CreateStatusModal({ isOpen, onClose, onStatusCreated }: CreateStatusModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg z-10"
          >
            <div className="absolute -top-12 right-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            <CreatePost 
              className="mb-0"
              onPostCreated={() => {
                onStatusCreated();
                onClose();
              }} 
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
