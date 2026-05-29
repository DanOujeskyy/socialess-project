require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoScreenTime'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = { 'Socialess' => 'dev@socialess.app' }
  s.homepage       = 'https://github.com/socialess/app'
  s.platform       = :ios, '16.0'
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files   = 'ios/**/*.{h,m,mm,swift}'

  # Screen Time frameworks (required entitlement: com.apple.developer.family-controls)
  s.frameworks = ['FamilyControls', 'ManagedSettings']
end
