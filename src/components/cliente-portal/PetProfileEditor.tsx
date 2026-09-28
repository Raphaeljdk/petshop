'use client'
import { useState } from 'react'
import { Camera, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { portalRequest } from './ExperienceProvider'
import { toast } from 'sonner'

export type PetProfile = {
  petKey: string
  photo: string | null
  size: 'pequeno' | 'medio' | 'grande' | 'gigante' | null
  birthday: string | null
  notes: string | null
}

async function resizePhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Escolha JPEG, PNG ou WebP de até 10 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new window.Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 640 / Math.max(image.width, image.height))
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/jpeg', 0.8)
    if (result.length > 400000) throw new Error('Escolha uma foto menor.')
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PetProfileEditor({
  petKey,
  name,
  profile,
  onSaved,
}: {
  petKey: string
  name: string
  profile?: PetProfile
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PetProfile>({
    petKey,
    photo: null,
    size: null,
    birthday: null,
    notes: null,
  })
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-2 border-t pt-3">
      {profile?.photo && (
        <img
          src={profile.photo}
          alt={`Foto de ${name}`}
          className="size-24 rounded-2xl object-cover"
        />
      )}
      {profile?.size && <p className="text-xs">Porte: {profile.size}</p>}
      {profile?.birthday && (
        <p className="text-xs">
          Nascimento: {profile.birthday.split('-').reverse().join('/')}
        </p>
      )}
      {profile?.notes && (
        <p className="whitespace-pre-wrap break-words text-xs">
          Cuidados: {profile.notes}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setForm(
            profile
              ? {
                  petKey,
                  photo: profile.photo,
                  size: profile.size,
                  birthday: profile.birthday,
                  notes: profile.notes,
                }
              : {
                  petKey,
                  photo: null,
                  size: null,
                  birthday: null,
                  notes: null,
                },
          )
          setOpen(true)
        }}
      >
        <Heart className="size-4" />
        Personalizar perfil
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perfil de {name}</DialogTitle>
            <DialogDescription>
              Foto e cuidados salvos na sua conta. Os dados oficiais de cadastro
              continuam na loja. Para necessidades especiais no atendimento,
              avise também a equipe.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium" htmlFor={`photo-${petKey}`}>
            <Camera className="mr-2 inline size-4" />
            Foto do pet
          </label>
          <Input
            id={`photo-${petKey}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                const photo = await resizePhoto(file)
                setForm((f) => ({ ...f, photo }))
              } catch (error) {
                toast.error((error as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          />
          {form.photo && (
            <div className="flex items-center gap-3">
              <img
                src={form.photo}
                alt="Prévia da foto"
                className="size-24 rounded-2xl object-cover"
              />
              <Button
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, photo: null }))}
              >
                Remover foto
              </Button>
            </div>
          )}
          <label htmlFor={`size-${petKey}`} className="text-sm font-medium">
            Porte
          </label>
          <select
            id={`size-${petKey}`}
            className="h-11 rounded-md border bg-background px-3"
            value={form.size || ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                size: (e.target.value || null) as PetProfile['size'],
              }))
            }
          >
            <option value="">Não informado</option>
            {['pequeno', 'medio', 'grande', 'gigante'].map((value) => (
              <option key={value} value={value}>
                {value === 'medio' ? 'Médio' : value}
              </option>
            ))}
          </select>
          <label htmlFor={`birthday-${petKey}`} className="text-sm font-medium">
            Data de nascimento
          </label>
          <Input
            id={`birthday-${petKey}`}
            type="date"
            value={form.birthday || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, birthday: e.target.value || null }))
            }
          />
          <label htmlFor={`notes-${petKey}`} className="text-sm font-medium">
            Observações de cuidado
          </label>
          <Textarea
            id={`notes-${petKey}`}
            maxLength={2000}
            value={form.notes || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value || null }))
            }
            placeholder="Rotina, preferências e cuidados importantes"
          />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await portalRequest('/api/cliente/perfil-pet', {
                  method: 'PUT',
                  body: JSON.stringify(form),
                })
                toast.success('Perfil salvo')
                setOpen(false)
                onSaved()
              } catch (error) {
                toast.error((error as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            Salvar perfil
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
