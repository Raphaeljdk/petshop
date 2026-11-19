'use client'

import { Input } from '@/components/ui/input'
import { formatCep } from '@/lib/auth-validation'
import { BRAZILIAN_UFS, type RegistrationAddressValues } from '@/lib/registration-address'

const UF_LABELS: Record<(typeof BRAZILIAN_UFS)[number], string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}

type FieldKey = keyof RegistrationAddressValues
type AddressProps = {
  value: RegistrationAddressValues
  onChange: (field: FieldKey, value: string) => void
  errors?: Record<string, string>
  disabled?: boolean
}

function AddressInput({ field, label, value, onChange, error, placeholder, required = true, ...rest }: {
  field: FieldKey
  label: string
  value: string
  onChange: (field: FieldKey, value: string) => void
  error?: string
  placeholder: string
  required?: boolean
  autoComplete?: string
  inputMode?: 'numeric' | 'text'
  maxLength?: number
}) {
  const id = 'registration-address-' + field
  return <div className="min-w-0">
    <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>
      {label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}
    </label>
    <Input {...rest} id={id} name={field} value={value} required={required}
      aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined}
      onChange={event => onChange(field, field === 'cep' ? formatCep(event.target.value) : event.target.value)}
      placeholder={placeholder} className="h-11 min-w-0 rounded-xl text-base" />
    {error && <p id={id + '-error'} className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
}

export function RegistrationAddressFields({ value, onChange, errors = {}, disabled }: AddressProps) {
  return <section aria-label="Endereço de cadastro" className="space-y-3 rounded-xl border bg-muted/20 p-3.5 sm:p-4">
    <div>
      <h3 className="text-sm font-semibold">Endereço completo <span className="text-destructive">*</span></h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Obrigatório para cadastro, entregas e pedidos. Informe onde deseja receber suas compras.
      </p>
    </div>
    <fieldset disabled={disabled} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <AddressInput field="cep" label="CEP" value={value.cep} onChange={onChange} error={errors.cep}
          inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" />
        <AddressInput field="numero" label="Número" value={value.numero} onChange={onChange} error={errors.numero}
          maxLength={20} placeholder="123 ou S/N" />
      </div>
      <AddressInput field="logradouro" label="Rua / Avenida" value={value.logradouro} onChange={onChange}
        error={errors.logradouro} autoComplete="address-line1" maxLength={110} placeholder="Ex.: Rua das Flores" />
      <AddressInput field="complemento" label="Complemento (opcional)" required={false} value={value.complemento}
        onChange={onChange} error={errors.complemento} autoComplete="address-line2" maxLength={70}
        placeholder="Apartamento, bloco, casa ou referência" />
      <AddressInput field="bairro" label="Bairro" value={value.bairro} onChange={onChange}
        error={errors.bairro} maxLength={80} placeholder="Ex.: Jardim São Paulo" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <AddressInput field="cidade" label="Cidade" value={value.cidade} onChange={onChange}
          error={errors.cidade} autoComplete="address-level2" maxLength={80} placeholder="Ex.: São Paulo" />
        <div className="min-w-0">
          <label htmlFor="registration-address-uf" className="mb-1.5 block text-sm font-medium">
            Estado (UF) <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <select name="uf" id="registration-address-uf" required value={value.uf}
            onChange={event => onChange('uf', event.target.value)}
            aria-invalid={!!errors.uf} aria-describedby={errors.uf ? 'registration-address-uf-error' : undefined}
            className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="">Selecione</option>
            {BRAZILIAN_UFS.map(uf => <option value={uf} key={uf}>{uf} — {UF_LABELS[uf]}</option>)}
          </select>
          {errors.uf && <p id="registration-address-uf-error" className="mt-1 text-xs text-destructive">{errors.uf}</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">* Campos obrigatórios. Se não existir número, informe S/N.</p>
    </fieldset>
  </section>
}
